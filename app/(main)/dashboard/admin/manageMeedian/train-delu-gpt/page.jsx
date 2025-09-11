"use client";

import React, { useState, useEffect, useRef } from 'react';
import DeluGPT from '@/components/DeluGPT';

const TrainDeluGPT = () => {
  const [mode, setMode] = useState('training'); // 'training' or 'expert'
  const [trainingMode, setTrainingMode] = useState('data'); // 'data' or 'interactive'
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [contentType, setContentType] = useState('file'); // 'file', 'text', 'json', 'context'
  const [contentInput, setContentInput] = useState('');
  const MAX_CONTEXT_TURNS = 12; // limit payload size to API
  const MAX_RENDER_MESSAGES = 100; // cap DOM messages for perf
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi, I’m DELU‑GPT. How can I help?' },
  ]);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [typing, setTyping] = useState(false);
  const abortRef = useRef(null);
  const [learningProgress, setLearningProgress] = useState(() => {
    const savedProgress = localStorage.getItem('deluLearningProgress');
    return savedProgress ? JSON.parse(savedProgress) : [];
  }); // Tracks what DeluGPT has learned
  const [showProgress, setShowProgress] = useState(false); // Toggle for showing learning progress
  const [trainerFeedback, setTrainerFeedback] = useState([]); // Tracks trainer feedback
  const synthRef = useRef(null);
  const recogRef = useRef(null);

  useEffect(() => {
    // Initialize TTS and STT
    synthRef.current = window.speechSynthesis || null;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.lang = 'en-US';
      recog.interimResults = true; // Enable continuous conversation
      recog.maxAlternatives = 1;
      recog.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join('');
        setInput(transcript);
      };
      recog.onend = () => {
        if (recognizing) recog.start(); // Restart recognition for continuous listening
      };
      recog.onerror = () => setRecognizing(false);
      recogRef.current = recog;
    }
  }, [recognizing]);

  useEffect(() => {
    // Save learning progress to localStorage whenever it changes
    localStorage.setItem('deluLearningProgress', JSON.stringify(learningProgress));
  }, [learningProgress]);

  const handleFileChange = (event) => {
    setSelectedFiles(event.target.files);
  };

  const handleUpload = async () => {
    if (contentType === 'file' && selectedFiles.length === 0) {
      alert('Please select files to upload.');
      return;
    }

    const formData = new FormData();

    if (contentType === 'file') {
      for (const file of selectedFiles) {
        formData.append('files', file);
      }
    } else {
      formData.append('content', contentInput);
      formData.append('type', contentType);
    }

    try {
      setUploadStatus('Uploading...');
      const response = await fetch('/api/admin/manageMeedian/train-delu-gpt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload content.');
      }

      setUploadStatus('Content uploaded successfully!');
    } catch (error) {
      console.error('Error uploading content:', error);
      setUploadStatus('Error uploading content.');
    }
  };

  const handleSendMessage = async (content) => {
    if (!content || busy) return;

    setMessages((prev) => [...prev, { role: 'user', content }]);
    setBusy(true);
    setTyping(true);
    try { abortRef.current?.abort(); } catch {}
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messagesRef.current, { role: 'user', content }].slice(-MAX_CONTEXT_TURNS),
        }),
        signal: controller.signal,
      });

      const data = await response.json();
      if (response.ok) {
        const reply = data.reply || '(No reply)';
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        setLearningProgress((prev) => [...prev, content]); // Add to learning progress
        if (synthRef.current) {
          const utterance = new SpeechSynthesisUtterance(reply);
          utterance.voice = synthRef.current.getVoices().find((voice) => voice.name.includes('Google UK English Female')) || null;
          utterance.pitch = 1.1; // Slightly higher pitch for a friendly tone
          utterance.rate = 0.95; // Slightly slower for clarity
          synthRef.current.speak(utterance);
        }
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: Unable to fetch response.' }]);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Error sending message:', error);
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: Unable to fetch response.' }]);
      }
    } finally {
      setBusy(false);
      setTyping(false);
    }
  };

  const handleStartRecognition = () => {
    if (recognizing || !recogRef.current) return;
    recogRef.current.start();
    setRecognizing(true);
  };

  const handleStopRecognition = () => {
    if (!recognizing || !recogRef.current) return;
    recogRef.current.stop();
    setRecognizing(false);
  };

  const handleClearConversation = () => {
    setMessages([{ role: 'assistant', content: 'Hi, I’m DELU‑GPT. How can I help?' }]);
  };

  const handleTrainerFeedback = (feedback) => {
    setTrainerFeedback((prev) => [...prev, feedback]);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 w-full h-full max-w-none">
        <h1 className="text-2xl font-bold mb-4 text-center">DeluGPT</h1>
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setMode('training')}
            className={`px-4 py-2 rounded-l ${mode === 'training' ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            Training Mode
          </button>
          <button
            onClick={() => setMode('expert')}
            className={`px-4 py-2 rounded-r ${mode === 'expert' ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            Expert Mode
          </button>
        </div>

        {mode === 'training' ? (
          <>
            <div className="flex justify-center mb-6">
              <button
                onClick={() => setTrainingMode('data')}
                className={`px-4 py-2 rounded-l ${trainingMode === 'data' ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                Data Upload
              </button>
              <button
                onClick={() => setTrainingMode('interactive')}
                className={`px-4 py-2 rounded-r ${trainingMode === 'interactive' ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                Interactive Training
              </button>
            </div>

            {trainingMode === 'data' ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
                  Upload documents or input content to train DeluGPT with new data.
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Select Content Type:</label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="file">File Upload</option>
                    <option value="text">Raw Text</option>
                    <option value="json">JSON</option>
                    <option value="context">Context</option>
                  </select>
                </div>

                {contentType === 'file' ? (
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 mb-4"
                  />
                ) : (
                  <textarea
                    value={contentInput}
                    onChange={(e) => setContentInput(e.target.value)}
                    placeholder="Enter your content here..."
                    className="w-full p-2 border rounded mb-4"
                    rows={6}
                  />
                )}

                <button
                  onClick={handleUpload}
                  className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Upload and Train
                </button>
                {uploadStatus && (
                  <p className="mt-4 text-center text-sm font-medium">
                    {uploadStatus}
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col h-full border rounded p-4 bg-gray-50 dark:bg-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
                  DeluGPT is in training mode. Please provide information to help it learn.
                </p>
                <div className="flex-1 overflow-y-auto mb-4">
                  {messages.slice(-MAX_RENDER_MESSAGES).map((msg, index) => (
                    <div
                      key={index}
                      className={`mb-2 p-2 rounded ${msg.role === 'user' ? 'bg-teal-100 text-teal-900 self-end' : 'bg-gray-200 text-gray-800 self-start'}`}
                    >
                      {msg.content}
                    </div>
                  ))}
                  {typing && (
                    <div className="mb-2 p-2 rounded bg-gray-200 text-gray-800 self-start">typing…</div>
                  )}
                </div>
                <div className="flex items-center mb-4">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 p-2 border rounded mr-2"
                  />
                  <button
                    onClick={() => {
                      handleSendMessage(input);
                      setInput('');
                    }}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded"
                    disabled={busy}
                  >
                    Send
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleStartRecognition}
                    className={`bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded ${recognizing ? 'opacity-50' : ''}`}
                    disabled={recognizing}
                  >
                    Start Listening
                  </button>
                  <button
                    onClick={handleStopRecognition}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
                    disabled={!recognizing}
                  >
                    Stop Listening
                  </button>
                  <button
                    onClick={handleClearConversation}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                  >
                    Clear Conversation
                  </button>
                </div>
                <button
                  onClick={() => setShowProgress((prev) => !prev)}
                  className="mt-4 bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded"
                >
                  {showProgress ? 'Hide Learning Progress' : 'Show Learning Progress'}
                </button>
                {showProgress && (
                  <div className="mt-4">
                    <h2 className="text-lg font-bold mb-2">Learning Progress</h2>
                    <ul className="list-disc pl-5">
                      {learningProgress.map((item, index) => (
                        <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                          {item}
                        </li>
                      ))}
                    </ul>
                    {learningProgress.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No learning progress yet.</p>
                    )}
                  </div>
                )}
                <div className="mt-4">
                  <h2 className="text-lg font-bold mb-2">Trainer Feedback</h2>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Provide feedback for DeluGPT..."
                    className="w-full p-2 border rounded mb-4"
                    rows={4}
                  />
                  <button
                    onClick={() => {
                      handleTrainerFeedback(input);
                      setInput('');
                    }}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded"
                  >
                    Submit Feedback
                  </button>
                  <ul className="list-disc pl-5 mt-4">
                    {trainerFeedback.map((feedback, index) => (
                      <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                        {feedback}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        ) : (
            <div className="flex flex-col h-full border rounded p-4 bg-gray-50 dark:bg-gray-700">
            <div className="flex-1 overflow-y-auto mb-4">
              {messages.slice(-MAX_RENDER_MESSAGES).map((msg, index) => (
                <div
                  key={index}
                  className={`mb-2 p-2 rounded ${msg.role === 'user' ? 'bg-teal-100 text-teal-900 self-end' : 'bg-gray-200 text-gray-800 self-start'}`}
                >
                  {msg.content}
                </div>
              ))}
              {typing && (
                <div className="mb-2 p-2 rounded bg-gray-200 text-gray-800 self-start">typing…</div>
              )}
            </div>
            <div className="flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 p-2 border rounded mr-2"
              />
              <button
                onClick={() => {
                  handleSendMessage(input);
                  setInput('');
                }}
                className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded"
                disabled={busy}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainDeluGPT;
