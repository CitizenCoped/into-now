"use client";

import { useAuth } from "@/hooks/useAuth";
import OnboardingGate from "./OnboardingGate";

type Props = {
  children: React.ReactNode;
};

export default function OnboardingWrapper({ children }: Props) {
  const {
    user,
    loading,
    createAnonymous,
    sendPhoneCode,
    sendEmailCode,
    verifyPhoneCode,
    verifyEmailCode,
  } = useAuth();

  return (
    <OnboardingGate
      user={user}
      loading={loading}
      onCreateAnonymous={async (birthDate) => {
        await createAnonymous(birthDate);
      }}
      onSendPhoneCode={sendPhoneCode}
      onSendEmailCode={sendEmailCode}
      onVerifyPhoneCode={verifyPhoneCode}
      onVerifyEmailCode={verifyEmailCode}
    >
      {children}
    </OnboardingGate>
  );
}