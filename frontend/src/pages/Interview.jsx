import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatBox from "../components/ChatBox";
import {
  nextQuestion,
  startInterview,
  synthesizeInterviewSpeech,
  transcribeInterviewAudio
} from "../services/api";

const AUTH_STORAGE_KEY = "ai-interview-auth";
const RESUME_STORAGE_KEY = "ai-interview-resume";
const FRIENDLY_ERROR_MESSAGE = "Something went wrong. Please try again.";
const FEEDBACK_DISPLAY_DELAY_MS = 550;

function Interview() {
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = useMemo(() => JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null"), []);
  const savedResume = useMemo(() => JSON.parse(localStorage.getItem(RESUME_STORAGE_KEY) || "null"), []);
  const resumeText = location.state?.resumeText || savedResume?.resumeText || "";
  const mode = location.state?.mode || "resume";
  const difficulty = location.state?.difficulty || "intermediate";

  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ current: 1, total: 5 });
  const [statusLabel, setStatusLabel] = useState("Preparing your interview...");
  const [voiceHint, setVoiceHint] = useState("Use the mic to answer. You can still type manually anytime.");
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);
  const audioUrlRef = useRef("");
  const lastSpokenMessageRef = useRef("");
  const supportsSpeechSynthesis = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);

  useEffect(() => {
    if (!resumeText) {
      navigate("/interview-workspace", { replace: true });
      return;
    }

    const bootInterview = async () => {
      setLoading(true);
      setError("");
      setStatusLabel("Preparing your interview...");

      try {
        const response = await startInterview({
          userId: authUser?.id || "admin",
          resumeText,
          mode,
          difficulty
        });

        setSessionId(response.sessionId);
        setProgress({ current: 1, total: response.maxQuestions || 5 });
        setMessages([
          {
            role: "interviewer",
            content: response.firstQuestion
          }
        ]);
        setStatusLabel("Interview ready");
      } catch (startError) {
        setError(startError.message || FRIENDLY_ERROR_MESSAGE);
        setStatusLabel("");
      } finally {
        setLoading(false);
      }
    };

    bootInterview();
  }, [authUser, difficulty, mode, navigate, resumeText]);

  useEffect(() => {
    if (!voiceEnabled || !messages.length) {
      return;
    }

    const latestMessage = messages[messages.length - 1];

    if (!latestMessage || latestMessage.role === "candidate") {
      return;
    }

    if (lastSpokenMessageRef.current === latestMessage.content) {
      return;
    }

    const playVoice = async () => {
      try {
        stopActiveAudio();
        const ttsResponse = await synthesizeInterviewSpeech(latestMessage.content);

        if (ttsResponse.fallback) {
          if (!supportsSpeechSynthesis) {
            setVoiceHint("ElevenLabs is unavailable and browser voice fallback is not supported. The text response is still shown below.");
            return;
          }

          const utterance = new SpeechSynthesisUtterance(ttsResponse.text);
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
          setVoiceHint("Using browser voice fallback.");
          lastSpokenMessageRef.current = latestMessage.content;
          return;
        }

        const audioUrl = URL.createObjectURL(ttsResponse.audio);
        audioUrlRef.current = audioUrl;
        const audio = new Audio(audioUrl);
        audioPlayerRef.current = audio;
        await audio.play();
        setVoiceHint("Voice playback enabled.");
        lastSpokenMessageRef.current = latestMessage.content;
      } catch (_error) {
        setVoiceHint("Voice playback is unavailable right now. The text response is still shown below.");
      }
    };

    playVoice();
  }, [messages, voiceEnabled]);

  useEffect(() => {
    return () => {
      stopRecordingTracks();
      stopActiveAudio();
    };
  }, []);

  const stopRecordingTracks = () => {
    mediaRecorderRef.current?.stream?.getTracks?.().forEach((track) => track.stop());
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
  };

  const stopActiveAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }

    if (supportsSpeechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const supportsVoiceCapture = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  const isBusy = loading || submitting || isTranscribing;

  const handleStartRecording = async () => {
    if (!supportsVoiceCapture || isBusy || isRecording) {
      return;
    }

    setError("");
    setVoiceHint("Listening...");
    setStatusLabel("Listening...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        stopRecordingTracks();

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (!audioBlob.size) {
          setError("No voice input was captured. Please try again or type your answer.");
          setStatusLabel("No audio captured");
          return;
        }

        setIsTranscribing(true);
        setVoiceHint("Processing...");
        setStatusLabel("Processing...");

        try {
          const transcriptResponse = await transcribeInterviewAudio(
            new File([audioBlob], "answer.webm", { type: mimeType })
          );
          const transcript = transcriptResponse.transcript || "";

          if (!transcript.trim()) {
            setError("No speech was detected. Please try again or type your answer.");
            setStatusLabel("No speech detected");
            return;
          }

          setAnswer(transcript);
          setVoiceHint("Transcribed successfully. Sending your answer...");
          await submitAnswer(transcript);
        } catch (_error) {
          setError("Voice transcription failed. Please type your answer instead.");
          setStatusLabel("Voice transcription unavailable");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaStreamRef.current = stream;
      setIsRecording(true);
      mediaRecorder.start();
    } catch (_error) {
      setError("Microphone access was denied. Please enable microphone access or type your answer.");
      setStatusLabel("Microphone unavailable");
    }
  };

  const handleStopRecording = () => {
    if (!isRecording) {
      return;
    }

    mediaRecorderRef.current?.stop();
    setVoiceHint("Processing...");
  };

  const submitAnswer = async (answerText) => {
    const trimmedAnswer = answerText.trim();

    if (!trimmedAnswer || !sessionId) {
      return;
    }

    const nextMessages = [
      ...messages,
      { role: "candidate", content: trimmedAnswer }
    ];

    setMessages(nextMessages);
    setAnswer("");
    setSubmitting(true);
    setError("");
    setStatusLabel("Reviewing your answer...");

    try {
      const response = await nextQuestion({
        sessionId,
        answer: trimmedAnswer
      });

      const updatedMessages = [
        ...nextMessages,
        { role: "feedback", content: response.feedback }
      ];

      setMessages(updatedMessages);
      setStatusLabel(response.status === "completed" ? "Finalizing your report..." : "Preparing the next question...");

      await new Promise((resolve) => {
        window.setTimeout(resolve, FEEDBACK_DISPLAY_DELAY_MS);
      });

      if (response.status === "completed") {
        navigate(`/report/${sessionId}`, {
          replace: true,
          state: { reportData: response }
        });
        return;
      }

      if (response.nextQuestion) {
        updatedMessages.push({
          role: "interviewer",
          content: response.nextQuestion
        });
      }

      setMessages(updatedMessages);
      setProgress({
        current: Math.min((response.currentQuestion || progress.current) + 1, response.maxQuestions || progress.total),
        total: response.maxQuestions || progress.total
      });
      setStatusLabel("Ready for your next answer");
      setVoiceHint("Use the mic or type your next answer.");
    } catch (submitError) {
      setError(submitError.message || FRIENDLY_ERROR_MESSAGE);
      setStatusLabel("Please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await submitAnswer(answer);
  };

  const progressValue = progress.total ? (progress.current / progress.total) * 100 : 0;
  const hasResume = Boolean(resumeText.trim());

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{mode} mode | {difficulty}</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Interview in progress</h1>
          </div>

          <button
            type="button"
            onClick={() => navigate("/interview-workspace")}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            Back to Interview Workspace
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {!hasResume ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No resume uploaded. Please return to the dashboard and add a resume before starting.
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 shadow-lg shadow-slate-200/70">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="h-3 w-3 animate-pulse rounded-full bg-slate-400" />
              Preparing the interview...
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#0f172a,#14b8a6)]" />
            </div>
          </div>
        ) : (
          <ChatBox
            messages={messages}
            answer={answer}
            onAnswerChange={setAnswer}
            onSubmit={handleSubmit}
            isLoading={loading || isTranscribing}
            isSubmitting={submitting}
            progressText={`Question ${progress.current} of ${progress.total}`}
            progressValue={progressValue}
            statusLabel={statusLabel}
            footerActions={[
              {
                label: isRecording ? "Stop Mic" : "Start Mic",
                onClick: isRecording ? handleStopRecording : handleStartRecording,
                disabled: !supportsVoiceCapture || isBusy,
                variant: "secondary"
              },
              {
                label: voiceEnabled ? "Voice On" : "Voice Off",
                onClick: () => {
                  if (voiceEnabled) {
                    stopActiveAudio();
                  }

                  setVoiceEnabled((current) => !current);
                },
                disabled: false,
                variant: "primary"
              }
            ]}
            footerHint={
              supportsVoiceCapture
                ? voiceHint
                : "Microphone capture is not supported in this browser. Please type your answer."
            }
          />
        )}
      </div>
    </div>
  );
}

export default Interview;
