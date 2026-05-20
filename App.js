import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib/supabase';
import RegisterScreen from './screens/RegisterScreen';
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import LoadingScreen from './screens/LoadingScreen';
import TrainingPlanScreen from './screens/TrainingPlanScreen';
import ProfileScreen from './screens/ProfileScreen';
import { generatePlan } from './services/generatePlan';

const RETURNING_KEY = 'swimmy_returning';

export default function App() {
  const [status, setStatus] = useState('loading_auth');
  const [user, setUser]     = useState(null);
  const [profile, setProfile] = useState(null);
  const [plan, setPlan]     = useState(null);

  // ── Auth initialisation ──────────────────────────────────────────────────────

  useEffect(() => {
    // INITIAL_SESSION fires after the JWT is fully applied to the client,
    // so RLS-protected queries made inside loadUserData will have auth headers set.
    // getSession() returns the token earlier but before the client is ready to use it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session) {
          loadUserData(session);
        } else {
          AsyncStorage.getItem(RETURNING_KEY).then((returning) =>
            setStatus(returning ? 'login' : 'register')
          );
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setPlan(null);
        setProfile(null);
        setStatus('login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadUserData = async (session) => {
    setUser(session.user);
    setStatus('loading_auth');

    // Fire-and-forget — profile sync must not block routing
    supabase.from('profiles').upsert({
      id:         session.user.id,
      first_name: session.user.user_metadata?.first_name ?? '',
      last_name:  session.user.user_metadata?.last_name  ?? '',
      email:      session.user.email ?? '',
    }, { onConflict: 'id' });

    const { data: planRow, error } = await supabase
      .from('plans')
      .select('plan_data')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // DB unreachable or tables not yet created — show login so the user
      // can retry. Never drop a logged-in user into onboarding on an error.
      console.error('[App] loadUserData error:', error.message);
      setStatus('login');
      return;
    }

    if (planRow?.plan_data) {
      setPlan(planRow.plan_data);
      setProfile({ name: session.user.user_metadata?.first_name ?? '' });
      setStatus('home');
    } else {
      setStatus('onboarding');
    }
  };

  // ── Auth handlers ────────────────────────────────────────────────────────────

  const handleRegister = async ({ firstName, lastName, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });

    if (error) return { error: error.message };

    if (data.session) {
      // Email confirmations disabled — session returned immediately
      await AsyncStorage.setItem(RETURNING_KEY, '1');
      setUser(data.user);
      await supabase.from('profiles').upsert({
        id: data.user.id, first_name: firstName, last_name: lastName, email,
      }, { onConflict: 'id' });
      setStatus('onboarding');
      return {};
    }

    return { confirmEmail: true };
  };

  const handleLogin = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    await AsyncStorage.setItem(RETURNING_KEY, '1');
    await loadUserData(data.session);
    return {};
  };

  // ── Sign out ─────────────────────────────────────────────────────────────────

  const handleSignOut = () => supabase.auth.signOut();

  // ── Onboarding & plan generation ─────────────────────────────────────────────

  const handleOnboardingComplete = async (answers) => {
    setStatus('loading');
    try {
      const result = await generatePlan(answers);
      setPlan(result);
      setProfile({ name: answers.name });

      if (user) {
        const { error } = await supabase
          .from('plans')
          .insert({ user_id: user.id, plan_data: result });
        if (error) console.error('[App] Failed to save plan:', error.message);
      }
    } catch (e) {
      console.error('[App] generatePlan failed:', e?.message ?? e);
    }
    setStatus('home');
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (status === 'loading_auth') return <LoadingScreen />;

  if (status === 'register') {
    return (
      <RegisterScreen
        onRegister={handleRegister}
        onGoToLogin={() => setStatus('login')}
      />
    );
  }

  if (status === 'login') {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onGoToRegister={() => setStatus('register')}
      />
    );
  }

  if (status === 'onboarding') {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  if (status === 'loading') return <LoadingScreen />;

  if (status === 'plan') {
    return <TrainingPlanScreen plan={plan} onBack={() => setStatus('home')} />;
  }

  if (status === 'profile') {
    return (
      <ProfileScreen
        profile={profile}
        user={user}
        onSignOut={handleSignOut}
        onBack={() => setStatus('home')}
      />
    );
  }

  return (
    <HomeScreen
      profile={profile}
      plan={plan}
      onOpenPlan={() => setStatus('plan')}
      onOpenProfile={() => setStatus('profile')}
      onSignOut={handleSignOut}
    />
  );
}
