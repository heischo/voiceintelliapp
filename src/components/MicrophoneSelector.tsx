'use client';

import { useState, useEffect, useCallback } from 'react';

interface AudioDevice {
  deviceId: string;
  label: string;
}

interface MicrophoneSelectorProps {
  value?: string;
  onChange: (deviceId: string) => void;
  disabled?: boolean;
}

export function MicrophoneSelector({ value, onChange, disabled }: MicrophoneSelectorProps) {
  const [microphones, setMicrophones] = useState<AudioDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micTestResult, setMicTestResult] = useState<'success' | 'error' | null>(null);

  const loadMicrophones = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        }));

      setMicrophones(audioInputs);

      // Select first mic if none selected
      if (audioInputs.length > 0 && !value) {
        onChange(audioInputs[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to load microphones:', err);
      setError('Failed to access microphones. Please check permissions.');
    } finally {
      setIsLoading(false);
    }
  }, [value, onChange]);

  useEffect(() => {
    loadMicrophones();
  }, [loadMicrophones]);

  const testMicrophone = async () => {
    if (!value) return;

    setIsTestingMic(true);
    setMicTestResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: value } }
      });

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      let hasSound = false;
      const checkInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        if (average > 10) {
          hasSound = true;
        }
      }, 100);

      await new Promise(resolve => setTimeout(resolve, 2000));
      clearInterval(checkInterval);

      stream.getTracks().forEach(track => track.stop());
      audioContext.close();

      setMicTestResult(hasSound ? 'success' : 'error');
    } catch (err) {
      console.error('Mic test failed:', err);
      setMicTestResult('error');
    } finally {
      setIsTestingMic(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse bg-secondary rounded-lg h-12" />
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-error/10 border border-error rounded-lg">
        <p className="text-error text-sm">{error}</p>
        <button
          onClick={loadMicrophones}
          className="mt-2 text-sm text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="input w-full"
      >
        {microphones.length === 0 ? (
          <option value="">No microphones found</option>
        ) : (
          microphones.map((mic) => (
            <option key={mic.deviceId} value={mic.deviceId}>
              {mic.label}
            </option>
          ))
        )}
      </select>

      <div className="flex items-center gap-3">
        <button
          onClick={testMicrophone}
          disabled={disabled || isTestingMic || !value}
          className="btn-secondary text-sm px-4 py-2"
        >
          {isTestingMic ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Testing...
            </span>
          ) : (
            'Test Microphone'
          )}
        </button>

        {micTestResult === 'success' && (
          <span className="text-success text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Working!
          </span>
        )}

        {micTestResult === 'error' && (
          <span className="text-error text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            No audio detected
          </span>
        )}
      </div>
    </div>
  );
}
