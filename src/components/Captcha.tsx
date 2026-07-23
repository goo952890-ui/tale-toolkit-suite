import { useMemo, useState } from "react";

export type CaptchaValue = { question: string; answer: string; user: string };

export function useCaptcha() {
  const [nonce, setNonce] = useState(0);
  const challenge = useMemo(() => {
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 9) + 1;
    return { a, b, question: `${a} + ${b} = ?`, answer: String(a + b) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);
  const [user, setUser] = useState("");
  return {
    question: challenge.question,
    valid: user.trim() === challenge.answer,
    user,
    setUser,
    reset: () => { setUser(""); setNonce((n) => n + 1); },
  };
}

export function CaptchaField({
  question, value, onChange,
}: { question: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="rounded bg-muted px-2 py-1 font-mono text-xs">{question}</span>
      <input
        className="w-24 rounded border border-input bg-background px-3 py-2 text-sm"
        placeholder="Answer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        required
      />
    </label>
  );
}
