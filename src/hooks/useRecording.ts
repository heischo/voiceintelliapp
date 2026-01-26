'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { RecordingState } from '../types';
import { MIN_RECORDING_DURATION, MAX_RECORDING_DURATION } from '../lib/config';

interface UseRecordingOptions {
  selectedMicrophone?: string;
}

interface UseRecordingReturn {
  state: RecordingState;
  duration: number;
  audioLevel: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
}

// Helper function to encode PCM samples to WAV format
function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, 1, true); // NumChannels (Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function useRecording(options: UseRecordingOptions = {}): UseRecordingReturn {
  const { selectedMicrophone } = options;
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sampleRateRef = useRef<number>(16000);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const average = sum / dataArray.length;
    const normalized = Math.min(100, Math.round((average / 255) * 100));

    setAudioLevel(normalized);

    if (state === 'recording') {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [state]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setState('recording');
      setDuration(0);
      audioChunksRef.current = [];

      // Request microphone access with 16kHz sample rate for whisper
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Create audio context with 16kHz sample rate
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      sampleRateRef.current = audioContext.sampleRate;

      const source = audioContext.createMediaStreamSource(stream);

      // Set up audio analysis for visualization
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Create ScriptProcessorNode to capture raw audio
      // Using 4096 buffer size for good balance of latency and performance
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Make a copy of the data
        const chunk = new Float32Array(inputData.length);
        chunk.set(inputData);
        audioChunksRef.current.push(chunk);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Start audio level monitoring
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          // Auto-stop at max duration
          if (newDuration >= MAX_RECORDING_DURATION) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
    } catch (err) {
      setState('error');
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone access denied. Please allow microphone access in your browser settings.');
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to start recording');
      }
    }
    // Note: stopRecording is intentionally omitted to prevent circular dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMicrophone, updateAudioLevel]);

  const cancelRecording = useCallback(() => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Reset state
    audioChunksRef.current = [];
    setState('idle');
    setDuration(0);
    setAudioLevel(0);
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Check if we have audio data
    if (audioChunksRef.current.length === 0) {
      setState('idle');
      return null;
    }

    // Check minimum duration
    if (duration < MIN_RECORDING_DURATION) {
      setError(`Recording too short. Minimum duration is ${MIN_RECORDING_DURATION} seconds.`);
      cancelRecording();
      return null;
    }

    setState('processing');

    // Stop processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Combine all audio chunks into one Float32Array
    const totalLength = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunksRef.current) {
      combinedSamples.set(chunk, offset);
      offset += chunk.length;
    }

    // Encode as WAV
    const wavBlob = encodeWAV(combinedSamples, sampleRateRef.current);
    audioChunksRef.current = [];

    setState('completed');
    setAudioLevel(0);

    return wavBlob;
  }, [duration, cancelRecording]);

  return {
    state,
    duration,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
