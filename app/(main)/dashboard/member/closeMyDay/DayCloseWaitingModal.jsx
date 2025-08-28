"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import Lottie from "lottie-react";

export default function DayCloseWaitingModal({ showWaitingModal, isWaitingForApproval, elapsedTime, formatElapsedTime }) {
  const [loading1Animation, setLoading1Animation] = useState(null);
  const [loading2Animation, setLoading2Animation] = useState(null);
  const [activity, setActivity] = useState("quiz");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [usedQuestionIndices, setUsedQuestionIndices] = useState([]);
  const [currentQuizQuestions, setCurrentQuizQuestions] = useState([]);
  const [showNewQuizPrompt, setShowNewQuizPrompt] = useState(false);
  const [currentWords, setCurrentWords] = useState([]);
  const [usedWordIndices, setUsedWordIndices] = useState([]);
  const [lastWordResetDate, setLastWordResetDate] = useState(null);

  // Quiz question pool
  const quizQuestionPool = [
    {
      question: "What is the capital of France?",
      options: ["Paris", "London", "Berlin", "Madrid"],
      correctAnswer: "Paris",
    },
    {
      question: "Which planet is known as the Red Planet?",
      options: ["Jupiter", "Mars", "Venus", "Mercury"],
      correctAnswer: "Mars",
    },
    {
      question: "What is 2 + 2?",
      options: ["3", "4", "5", "6"],
      correctAnswer: "4",
    },
    {
      question: "Which animal is known as man's best friend?",
      options: ["Cat", "Dog", "Bird", "Fish"],
      correctAnswer: "Dog",
    },
    {
      question: "What is the largest ocean on Earth?",
      options: ["Atlantic", "Indian", "Arctic", "Pacific"],
      correctAnswer: "Pacific",
    },
    {
      question: "What is the chemical symbol for water?",
      options: ["H2O", "CO2", "O2", "N2"],
      correctAnswer: "H2O",
    },
    {
      question: "Which country hosted the 2024 Summer Olympics?",
      options: ["Brazil", "Japan", "France", "USA"],
      correctAnswer: "France",
    },
    {
      question: "What is the tallest mountain in the world?",
      options: ["K2", "Kangchenjunga", "Everest", "Lhotse"],
      correctAnswer: "Everest",
    },
    {
      question: "Which element is number 1 on the periodic table?",
      options: ["Helium", "Hydrogen", "Lithium", "Beryllium"],
      correctAnswer: "Hydrogen",
    },
    {
      question: "What is the currency of Japan?",
      options: ["Yuan", "Won", "Yen", "Ringgit"],
      correctAnswer: "Yen",
    },
  ];

  // Word pool
  const wordPool = [
    { word: "Serendipity", definition: "The occurrence of finding something valuable when least expected." },
    { word: "Ephemeral", definition: "Lasting for a very short time." },
    { word: "Quixotic", definition: "Unrealistically optimistic or impractical." },
    { word: "Luminous", definition: "Bright or radiant, especially in a subtle way." },
    { word: "Ebullient", definition: "Cheerful and full of energy." },
    { word: "Pernicious", definition: "Having a harmful effect in a gradual or subtle way." },
    { word: "Mellifluous", definition: "Sweet or musical; pleasant to hear." },
    { word: "Resilient", definition: "Able to recover quickly from difficulties." },
    { word: "Nebulous", definition: "In the form of a cloud or haze; unclear or vague." },
    { word: "Ethereal", definition: "Extremely delicate and light, almost heavenly." },
  ];

  // Fetch Lottie animations
  useEffect(() => {
    fetch("/lottie/Loading1.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load Loading1 animation");
        return res.json();
      })
      .then((data) => setLoading1Animation(data))
      .catch((err) => console.error("Error loading Loading1 animation:", err));

    fetch("/lottie/Loading2.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load Loading2 animation");
        return res.json();
      })
      .then((data) => setLoading2Animation(data))
      .catch((err) => console.error("Error loading Loading2 animation:", err));
  }, []);

  // Initialize quiz or words when modal opens or activity changes
  useEffect(() => {
    if (showWaitingModal && isWaitingForApproval) {
      if (activity === "quiz") {
        // Reset quiz state
        let availableIndices = quizQuestionPool
          .map((_, index) => index)
          .filter((index) => !usedQuestionIndices.includes(index));
        if (availableIndices.length < 5) {
          setUsedQuestionIndices([]); // Reset if not enough questions
          availableIndices = quizQuestionPool.map((_, index) => index);
        }
        const selectedIndices = availableIndices
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.min(5, availableIndices.length));
        setCurrentQuizQuestions(selectedIndices.map((index) => quizQuestionPool[index]));
        setUsedQuestionIndices((prev) => [...new Set([...prev, ...selectedIndices])]);
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setQuizScore(0);
        setQuizFeedback("");
        setShowFeedback(false);
        setShowNewQuizPrompt(false);
      } else if (activity === "words") {
        // Reset words state
        const today = new Date().toISOString().split("T")[0];
        if (lastWordResetDate !== today) {
          setUsedWordIndices([]);
          setLastWordResetDate(today);
        }
        let availableIndices = wordPool
          .map((_, index) => index)
          .filter((index) => !usedWordIndices.includes(index));
        if (availableIndices.length < 3) {
          setUsedWordIndices([]); // Reset if not enough words
          availableIndices = wordPool.map((_, index) => index);
        }
        const selectedIndices = availableIndices
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.min(3, availableIndices.length));
        setCurrentWords(selectedIndices.map((index) => wordPool[index]));
        setUsedWordIndices((prev) => [...new Set([...prev, ...selectedIndices])]);
      }
    }
  }, [showWaitingModal, isWaitingForApproval, activity, lastWordResetDate]);

  const handleQuizSubmit = () => {
    if (selectedAnswer === null) {
      setQuizFeedback("Please select an answer!");
      setShowFeedback(true);
      return;
    }
    const currentQuestion = currentQuizQuestions[currentQuestionIndex];
    if (selectedAnswer === currentQuestion.correctAnswer) {
      setQuizScore((prev) => prev + 1);
      setQuizFeedback("Correct! Great job! 🎉");
    } else {
      setQuizFeedback(`Incorrect. The answer is ${currentQuestion.correctAnswer}.`);
    }
    setShowFeedback(true);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex + 1 < currentQuizQuestions.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setQuizFeedback("");
      setShowFeedback(false);
    } else {
      setShowNewQuizPrompt(true);
    }
  };

  const handleNewQuiz = () => {
    let availableIndices = quizQuestionPool
      .map((_, index) => index)
      .filter((index) => !usedQuestionIndices.includes(index));
    if (availableIndices.length < 5) {
      setUsedQuestionIndices([]);
      availableIndices = quizQuestionPool.map((_, index) => index);
    }
    const selectedIndices = availableIndices
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(5, availableIndices.length));
    setCurrentQuizQuestions(selectedIndices.map((index) => quizQuestionPool[index]));
    setUsedQuestionIndices((prev) => [...new Set([...prev, ...selectedIndices])]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setQuizFeedback("");
    setShowFeedback(false);
    setShowNewQuizPrompt(false);
  };

  const handleNewWords = () => {
    let availableIndices = wordPool
      .map((_, index) => index)
      .filter((index) => !usedWordIndices.includes(index));
    if (availableIndices.length < 3) {
      setUsedWordIndices([]);
      availableIndices = wordPool.map((_, index) => index);
    }
    const selectedIndices = availableIndices
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(3, availableIndices.length));
    setCurrentWords(selectedIndices.map((index) => wordPool[index]));
    setUsedWordIndices((prev) => [...new Set([...prev, ...selectedIndices])]);
  };

  return (
    <AnimatePresence>
      {showWaitingModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-[1000]"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-8 w-full max-w-6xl min-h-[450px] border border-teal-100/50 flex flex-row items-center justify-center gap-12 sm:p-6"
          >
            {/* Left: Animations and Timer */}
            <div className="flex flex-col items-center gap-6 w-1/3">
              {loading1Animation ? (
                <div className="w-48 h-48">
                  <Lottie animationData={loading1Animation} loop={true} />
                </div>
              ) : (
                <div className="w-48 h-48 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                </div>
              )}
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-800 mb-2">Time Waiting for Approval:</p>
                <div className="text-2xl font-bold text-teal-700 bg-teal-50/50 border border-teal-200 rounded-lg py-2 px-4">
                  {formatElapsedTime(elapsedTime)}
                </div>
              </div>
              {loading2Animation ? (
                <div className="w-48 h-48">
                  <Lottie animationData={loading2Animation} loop={true} />
                </div>
              ) : (
                <div className="w-48 h-48 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                </div>
              )}
            </div>

            {/* Right: Content and Activities */}
            <div className="flex-1 flex flex-col items-center gap-6">
              <h2 className="text-2xl font-bold text-teal-800">Hang Tight! Waiting for Approval 😄</h2>
              <p className="text-sm text-gray-600 text-center max-w-md">
                Your day close request is with your IS/Admin. Please stay on this page—it won’t take long! You’re almost done for the day! 🎉
              </p>
              {elapsedTime > 600 && (
                <p className="text-sm text-red-600 text-center max-w-md">
                  Approval is taking longer than expected (over 10 minutes). Please contact your IS/Admin if this persists.
                </p>
              )}
              <p className="text-xs text-gray-500 italic text-center max-w-md">
                Pick an activity to stay engaged while you wait! ☕💪
              </p>

              {/* Activity Selector */}
              <div className="flex gap-4 mb-4">
                <motion.button
                  onClick={() => setActivity("quiz")}
                  className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 shadow-sm ${
                    activity === "quiz" ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Play Quiz
                </motion.button>
                <motion.button
                  onClick={() => setActivity("words")}
                  className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 shadow-sm ${
                    activity === "words" ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Learn New Words
                </motion.button>
              </div>

              {/* Activity Content */}
              {activity === "quiz" && currentQuizQuestions.length > 0 && (
                <div className="w-full max-w-md bg-teal-50/50 border border-teal-200 rounded-xl p-6">
                  {showNewQuizPrompt ? (
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700 mb-4">
                        Great job! You scored {quizScore}/5. Want to play another quiz?
                      </p>
                      <motion.button
                        onClick={handleNewQuiz}
                        className="w-full bg-teal-600 text-white py-2 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 shadow-sm"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Start New Quiz
                      </motion.button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Quiz: Question {currentQuestionIndex + 1}/{currentQuizQuestions.length}
                      </h3>
                      <p className="text-sm font-medium text-gray-700 mb-4">{currentQuizQuestions[currentQuestionIndex]?.question}</p>
                      <div className="space-y-2 mb-4">
                        {currentQuizQuestions[currentQuestionIndex]?.options.map((option, index) => (
                          <label key={index} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="quiz-answer"
                              value={option}
                              checked={selectedAnswer === option}
                              onChange={() => setSelectedAnswer(option)}
                              className="text-teal-600 focus:ring-teal-500"
                              disabled={showFeedback}
                            />
                            <span className="text-sm text-gray-600">{option}</span>
                          </label>
                        ))}
                      </div>
                      {showFeedback && (
                        <p className={`text-sm mb-4 ${quizFeedback.includes("Correct") ? "text-green-600" : "text-red-600"}`}>{quizFeedback}</p>
                      )}
                      <div className="flex justify-between gap-4">
                        <motion.button
                          onClick={handleQuizSubmit}
                          disabled={showFeedback || selectedAnswer === null}
                          className={`flex-1 bg-teal-600 text-white py-2 rounded-xl font-semibold transition-all duration-300 shadow-sm ${
                            showFeedback || selectedAnswer === null ? "opacity-50 cursor-not-allowed" : "hover:bg-teal-700"
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Submit Answer
                        </motion.button>
                        {showFeedback && (
                          <motion.button
                            onClick={handleNextQuestion}
                            className="flex-1 bg-gray-600 text-white py-2 rounded-xl font-semibold hover:bg-gray-700 transition-all duration-300 shadow-sm"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Next Question
                          </motion.button>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-4">Score: {quizScore}/{currentQuizQuestions.length}</p>
                    </>
                  )}
                </div>
              )}
              {activity === "words" && currentWords.length > 0 && (
                <div className="w-full max-w-md bg-teal-50/50 border border-teal-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Learn New Words</h3>
                  <p className="text-sm text-gray-600 mb-4">Here are 3 new words for today. Write them in your journal to remember them!</p>
                  <div className="space-y-4 mb-4">
                    {currentWords.map((word, index) => (
                      <div key={index}>
                        <p className="text-sm font-medium text-gray-700">
                          <strong>{word.word}</strong>: {word.definition}
                        </p>
                      </div>
                    ))}
                  </div>
                  <motion.button
                    onClick={handleNewWords}
                    className="w-full bg-teal-600 text-white py-2 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 shadow-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Get New Words
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}