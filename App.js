import { useState } from 'react';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import LoadingScreen from './screens/LoadingScreen';
import { generatePlan } from './services/generatePlan';

export default function App() {
  const [status, setStatus] = useState('onboarding'); // 'onboarding' | 'loading' | 'home'
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);

  const handleOnboardingComplete = async (answers) => {
    setProfile(answers);
    setStatus('loading');
    try {
      const result = await generatePlan(answers);
      setPlan(result);
    } catch (e) {
      console.error('Plan generation failed:', e);
    }
    setStatus('home');
  };

  if (status === 'onboarding') {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  return <HomeScreen profile={profile} plan={plan} />;
}
