'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Question } from '@/components/diagnostic/Question';
import { ProgressBar } from '@/components/diagnostic/ProgressBar';
import { trpc } from '@/lib/trpc/client';

export default function DiagnosticSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('id');

  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    correctIndex: number;
    explanation: string;
  } | null>(null);

  const { data: sessionState, refetch, isLoading } = trpc.diagnostic.getSessionState.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId }
  );

  const submitAnswer = trpc.diagnostic.submitAnswer.useMutation({
    onSuccess: (data) => {
      setFeedback({
        isCorrect: data.isCorrect,
        correctIndex: data.correctIndex,
        explanation: data.explanation,
      });

      // Auto-advance after showing feedback
      setTimeout(() => {
        if (data.isComplete) {
          router.push(`/diagnostic/results?id=${sessionId}`);
        } else {
          setFeedback(null);
          refetch();
        }
      }, 2000);
    },
  });

  const handleAnswer = (selectedIndex: number) => {
    if (!sessionState?.currentQuestion || !sessionId) return;

    submitAnswer.mutate({
      sessionId,
      questionId: sessionState.currentQuestion.id,
      selectedIndex,
    });
  };

  // Redirect if no session
  useEffect(() => {
    if (!sessionId) {
      router.push('/diagnostic');
    }
  }, [sessionId, router]);

  // Redirect if session complete
  useEffect(() => {
    if (sessionState?.isComplete) {
      router.push(`/diagnostic/results?id=${sessionId}`);
    }
  }, [sessionState?.isComplete, sessionId, router]);

  if (!sessionId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-mp-card">
          <CardContent className="py-12 text-center">
            <svg className="animate-spin h-10 w-10 mx-auto text-mp-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="mt-4 text-body text-mp-gray-500">Загрузка вопроса...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!sessionState || !sessionState.currentQuestion) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-mp-card">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-mp-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-mp-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-body text-mp-gray-500">Сессия не найдена</p>
            <Button className="mt-4" onClick={() => router.push('/diagnostic')}>
              Начать заново
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <ProgressBar
        current={sessionState.currentQuestionIndex + 1}
        total={sessionState.totalQuestions}
      />

      {/* Question card */}
      <Card className="shadow-mp-card">
        <CardContent className="py-8">
          <Question
            question={sessionState.currentQuestion}
            onAnswer={handleAnswer}
            isSubmitting={submitAnswer.isPending}
            feedback={feedback}
          />
        </CardContent>
      </Card>

      {/* Next button after feedback */}
      {feedback && (
        <div className="text-center text-body-sm text-mp-gray-400">
          Переход к следующему вопросу...
        </div>
      )}
    </div>
  );
}
