import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import RegisterScreen from './screens/RegisterScreen';
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import LoadingScreen from './screens/LoadingScreen';
import TrainingPlanScreen from './screens/TrainingPlanScreen';
import { generatePlan } from './services/generatePlan';

export default function App() {
  const [status, setStatus] = useState('loading_auth');
  const [user, setUser]     = useState(null);
  const [profile, setProfile] = useState(null);
  const [plan, setPlan]     = useState(null);

  // ── Auth initialisation ──────────────────────────────────────────────────────

  useEffect(() => {
    // Restore persisted session on app launch
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadUserData(session);
      } else {
        setStatus('register');
      }
    });

    // React to sign-out (token expiry, manual sign-out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setPlan(null);
        setProfile(null);
        setStatus('register');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadUserData = async (session) => {
    setUser(session.user);
    setStatus('loading_auth');

    try {
      // Ensure a profile row exists — created here so it works whether email
      // confirmation was instant or delayed.
      await supabase.from('profiles').upsert({
        id:         session.user.id,
        first_name: session.user.user_metadata?.first_name ?? '',
        last_name:  session.user.user_metadata?.last_name  ?? '',
        email:      session.user.email ?? '',
      }, { onConflict: 'id' });

      // Fetch the user's most recent training plan
      const { data: planRow, error } = await supabase
        .from('plans')
        .select('plan_data')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (planRow?.plan_data) {
        setPlan(planRow.plan_data);
        setProfile({ name: session.user.user_metadata?.first_name ?? '' });
        setStatus('home');
      } else {
        // New user with no plan — send to onboarding
        setStatus('onboarding');
      }
    } catch (e) {
      console.error('[App] loadUserData error:', e?.message ?? e);
      setStatus('onboarding');
    }
  };

  // ── Auth handlers (returned to screens as callbacks) ─────────────────────────

  const handleRegister = async ({ firstName, lastName, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });

    if (error) return { error: error.message };

    // If Supabase auto-confirmed the email (e.g. confirmations disabled in dashboard),
    // a session is returned immediately — skip straight to onboarding.
    if (data.session) {
      setUser(data.user);
      await supabase.from('profiles').upsert({
        id: data.user.id, first_name: firstName, last_name: lastName, email,
      }, { onConflict: 'id' });
      setStatus('onboarding');
      return {};
    }

    // Email confirmation required — tell the screen to show the confirm view.
    return { confirmEmail: true };
  };

  const handleLogin = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    await loadUserData(data.session);
    return {};
  };

  // ── Onboarding & plan generation ─────────────────────────────────────────────

  const handleOnboardingComplete = async (answers) => {
    setStatus('loading');
    try {
      const result = await generatePlan(answers);
      console.log('[App] Plan generated:', result?.weeks?.length, 'weeks');
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

  return (
    <HomeScreen
      profile={profile}
      plan={plan}
      onOpenPlan={() => setStatus('plan')}
    />
  );
}
