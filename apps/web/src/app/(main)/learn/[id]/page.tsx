'use client';

import { useRef, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VideoPlayer, type PlayerHandle } from '@/components/video/KinescopePlayer';
import { TimecodeLink } from '@/components/video/TimecodeLink';
import { DiagnosticGateBanner } from '@/components/learning/DiagnosticGateBanner';
import { CollapsibleSummary } from '@/components/learning/CollapsibleSummary';
import { trpc } from '@/lib/trpc/client';
import { SafeMarkdown } from '@/components/shared/SafeMarkdown';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<string, string> = {
  ANALYTICS: 'Аналитика',
  MARKETING: 'Маркетинг',
  CONTENT: 'Контент',
  OPERATIONS: 'Операции',
  FINANCE: 'Финансы',
};

const CATEGORY_BADGES: Record<string, 'analytics' | 'marketing' | 'content' | 'operations' | 'finance'> = {
  ANALYTICS: 'analytics',
  MARKETING: 'marketing',
  CONTENT: 'content',
  OPERATIONS: 'operations',
  FINANCE: 'finance',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    id: string;
    timecodeFormatted: string;
    content: string;
    timecode_start: number;
    timecode_end: number;
  }>;
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.id as string;

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerHandle>(null);

  const handleTimecodeClick = (seconds: number) => {
    playerRef.current?.seekTo(seconds);
    document.getElementById('video-player')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const { data, isLoading, error: lessonError } = trpc.learning.getLesson.useQuery({ lessonId });
  const { data: hasDiagnostic } = trpc.diagnostic.hasCompletedDiagnostic.useQuery();

  // Summary always loads (no longer gated by tab)
  const { data: summaryData, isLoading: summaryLoading, error: summaryError } = trpc.ai.getLessonSummary.useQuery(
    { lessonId },
  );

  // Chat mutation
  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (result) => {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: result.content,
        sources: result.sources,
      }]);
    },
  });

  const completeLesson = trpc.learning.completeLesson.useMutation({
    onSuccess: () => {
      if (data?.nextLesson) {
        router.push(`/learn/${data.nextLesson.id}`);
      } else {
        router.push('/learn');
      }
    },
  });

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendMessage = () => {
    if (!chatInput.trim() || chatMutation.isPending) return;

    const userMessage = chatInput.trim();
    setChatInput('');

    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    chatMutation.mutate({
      lessonId,
      message: userMessage,
      history: chatMessages.map(m => ({ role: m.role, content: m.content })),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-mp-gray-200 rounded-lg w-64 animate-pulse" />
        <div className="aspect-video bg-mp-gray-200 rounded-xl animate-pulse" />
        <div className="h-48 bg-mp-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (lessonError) {
    const isDbDown = lessonError.message === 'DATABASE_UNAVAILABLE' || lessonError.message.includes('DATABASE_UNAVAILABLE');
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-mp-card border-red-200">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-heading text-mp-gray-900 mb-2">
              {isDbDown ? 'База данных недоступна' : 'Ошибка загрузки урока'}
            </h2>
            <p className="text-body text-mp-gray-500 mb-4">
              {isDbDown
                ? 'Не удалось подключиться к базе данных. Попробуйте позже.'
                : 'Произошла ошибка при загрузке урока.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => router.push('/learn')}>
                К списку уроков
              </Button>
              <Button onClick={() => window.location.reload()}>
                Обновить
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.lesson) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-mp-card">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-mp-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-mp-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-body text-mp-gray-500">Урок не найден</p>
            <Button className="mt-4" onClick={() => router.push('/learn')}>
              К списку уроков
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { lesson, course, nextLesson, prevLesson, currentLessonNumber, totalLessonsInCourse } = data;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-body-sm">
        <Link href="/learn" className="text-mp-gray-500 hover:text-mp-blue-600 transition-colors">
          Обучение
        </Link>
        <span className="text-mp-gray-400">/</span>
        <span className="text-mp-gray-500">{course?.title}</span>
        <span className="text-mp-gray-400">/</span>
        <span className="text-mp-gray-900 font-medium">Урок {currentLessonNumber}</span>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={CATEGORY_BADGES[lesson.skillCategory]}>
            {CATEGORY_LABELS[lesson.skillCategory]}
          </Badge>
          <span className="text-body-sm text-mp-gray-500">
            Урок {currentLessonNumber} из {totalLessonsInCourse}
          </span>
        </div>
        <h1 className="text-display-sm text-mp-gray-900">{lesson.title}</h1>
        {lesson.description && (
          <p className="text-body text-mp-gray-500 mt-1">{lesson.description}</p>
        )}
      </div>

      {hasDiagnostic === false ? (
        <DiagnosticGateBanner />
      ) : (
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column: Video + Summary + Navigation */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video player */}
          <Card id="video-player" className="overflow-hidden shadow-mp-card">
            <VideoPlayer
              ref={playerRef}
              videoId={lesson.videoId}
            />
          </Card>

          {/* Summary section — under video */}
          {(summaryLoading || summaryError || summaryData?.content) && (
            <div className="space-y-2">
              <h2 className="text-heading flex items-center gap-2 text-mp-gray-900">
                <svg className="w-5 h-5 text-mp-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Ключевые тезисы
                {summaryData?.fromCache && (
                  <span className="text-xs text-mp-gray-400 font-normal">(кэш)</span>
                )}
              </h2>

              <CollapsibleSummary
                isLoading={summaryLoading}
                error={summaryError?.message}
              >
                <SafeMarkdown
                  content={summaryData?.content || ''}
                  className="prose prose-sm max-w-none text-body-sm text-mp-gray-700"
                  sources={summaryData?.sources}
                  onSourceSeek={handleTimecodeClick}
                  disableSourceLinks={!lesson.videoId}
                />

                {/* Footnotes block */}
                {summaryData?.sources && summaryData.sources.length > 0 && (
                  <div className="border-t border-mp-gray-200 pt-3 mt-4">
                    <p className="text-xs font-medium text-mp-gray-500 mb-2">Источники:</p>
                    <div className="space-y-1">
                      {summaryData.sources.map((source, idx) => (
                        <div key={source.id} className="flex items-start gap-2 text-xs text-mp-gray-600">
                          <span className="text-mp-blue-600 font-semibold shrink-0">[{idx + 1}]</span>
                          <span className="flex-1 line-clamp-1">{source.content.slice(0, 80)}...</span>
                          <TimecodeLink
                            startSeconds={source.timecode_start}
                            formattedTime={source.timecodeFormatted}
                            onSeek={handleTimecodeClick}
                            disabled={!lesson.videoId}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CollapsibleSummary>
            </div>
          )}

          {/* Lesson info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-body-sm text-mp-gray-500">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {lesson.duration} мин
              </span>
              <Badge variant={
                lesson.status === 'COMPLETED' ? 'success' :
                lesson.status === 'IN_PROGRESS' ? 'primary' :
                'default'
              }>
                {lesson.status === 'COMPLETED' ? 'Завершён' :
                 lesson.status === 'IN_PROGRESS' ? `${lesson.watchedPercent}% просмотрено` :
                 'Не начат'}
              </Badge>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-mp-gray-200">
            {prevLesson ? (
              <Link href={`/learn/${prevLesson.id}`}>
                <Button variant="outline" size="sm">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Предыдущий
                </Button>
              </Link>
            ) : (
              <div />
            )}

            {lesson.status !== 'COMPLETED' && (
              <Button
                variant="success"
                onClick={() => completeLesson.mutate({ lessonId })}
                disabled={completeLesson.isPending}
              >
                {completeLesson.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Сохранение...
                  </>
                ) : (
                  'Завершить урок'
                )}
              </Button>
            )}

            {nextLesson ? (
              <Link href={`/learn/${nextLesson.id}`}>
                <Button variant="outline" size="sm">
                  Следующий
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </Link>
            ) : (
              <Link href="/learn">
                <Button variant="outline" size="sm">
                  К списку
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Sidebar — Chat only (no tabs) */}
        <div className="space-y-4">
          <Card className="h-[500px] flex flex-col shadow-mp-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-heading flex items-center gap-2">
                <svg className="w-5 h-5 text-mp-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Задайте вопрос по уроку
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0">
              {/* Messages */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto space-y-3 mb-3"
              >
                {chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-mp-gray-400 text-body-sm text-center p-4">
                    <div>
                      <div className="w-14 h-14 rounded-2xl bg-mp-gray-100 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-7 h-7 text-mp-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <p className="text-body-sm">Спросите что угодно по материалу урока</p>
                      <p className="text-xs text-mp-gray-400 mt-1">AI найдёт ответ в транскрипте</p>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={cn(
                      'rounded-lg p-3 text-body-sm',
                      msg.role === 'user'
                        ? 'bg-mp-blue-50 text-mp-blue-900 ml-4'
                        : 'bg-mp-gray-100 text-mp-gray-800 mr-4'
                    )}>
                      <SafeMarkdown
                        content={msg.content}
                        className="prose prose-sm max-w-none"
                        sources={msg.sources}
                        onSourceSeek={handleTimecodeClick}
                        disableSourceLinks={!lesson.videoId}
                      />
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="border-t border-mp-gray-200 mt-2 pt-2">
                          <p className="text-xs text-mp-gray-500">Источники:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {msg.sources.map((src, i) => (
                              <span key={src.id} className="inline-flex items-center gap-1 text-xs">
                                <span className="text-mp-blue-600 font-medium">[{i+1}]</span>
                                <TimecodeLink
                                  startSeconds={src.timecode_start}
                                  formattedTime={src.timecodeFormatted}
                                  onSeek={handleTimecodeClick}
                                  disabled={!lesson.videoId}
                                />
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* Loading indicator */}
                {chatMutation.isPending && (
                  <div className="bg-mp-gray-100 rounded-lg p-3 mr-4">
                    <div className="flex items-center gap-2 text-body-sm text-mp-gray-600">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      AI думает...
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="pt-2 border-t border-mp-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Задайте вопрос по уроку..."
                    disabled={chatMutation.isPending}
                    className="flex-1 px-3 py-2 border border-mp-gray-300 rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-mp-blue-500 focus:border-transparent disabled:bg-mp-gray-50 disabled:text-mp-gray-400"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || chatMutation.isPending}
                    size="sm"
                  >
                    {chatMutation.isPending ? (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}
