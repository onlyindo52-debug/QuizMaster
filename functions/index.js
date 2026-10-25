const { setGlobalOptions } = require("firebase-functions");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

initializeApp();

const db = getFirestore();

// Limit concurrent containers for cost control.
setGlobalOptions({
    maxInstances: 10,
});

/**
 * Secure quiz scoring function.
 *
 * Trigger:
 * attempts/{attemptId}
 *
 * Flow:
 * Student submits answers
 *        ↓
 * Attempt document is created
 *        ↓
 * This function reads protected questions
 *        ↓
 * Correct answers are compared server-side
 *        ↓
 * Score/result fields are written to the attempt
 */
exports.scoreQuizAttempt = onDocumentCreated(
    "attempts/{attemptId}",
    async (event) => {
        const snapshot = event.data;

        if (!snapshot) {
            logger.error("Attempt document is missing.");
            return;
        }

        const attemptRef = snapshot.ref;
        const attemptData = snapshot.data();

        const attemptId = event.params.attemptId;

        logger.info("Scoring attempt", {
            attemptId: attemptId,
        });

        // Prevent processing invalid attempts.
        if (!attemptData) {
            await attemptRef.set(
                {
                    status: "scoring_failed",
                    errorMessage: "Attempt data is missing.",
                },
                { merge: true }
            );

            return;
        }

        const quizId = attemptData.quizId;
        const userId = attemptData.userId;
        const answers = attemptData.answers || {};
        const timeUp = attemptData.timeUp === true;

        // Basic validation.
        if (!quizId || !userId) {
            logger.error("Invalid attempt data.", {
                attemptId: attemptId,
                quizId: quizId,
                userId: userId,
            });

            await attemptRef.set(
                {
                    status: "scoring_failed",
                    errorMessage: "Invalid quiz or user information.",
                },
                { merge: true }
            );

            return;
        }

        try {
            /*
             * ------------------------------------------------------------
             * 1. Verify user
             * ------------------------------------------------------------
             */

            const userSnapshot = await db
                .collection("users")
                .doc(userId)
                .get();

            if (!userSnapshot.exists) {
                throw new Error("User profile does not exist.");
            }

            const userData = userSnapshot.data();

            if (userData.role !== "student") {
                throw new Error("Only student attempts can be scored.");
            }

            /*
             * ------------------------------------------------------------
             * 2. Get quiz
             * ------------------------------------------------------------
             */

            const quizSnapshot = await db
                .collection("quizzes")
                .doc(quizId)
                .get();

            if (!quizSnapshot.exists) {
                throw new Error("Quiz does not exist.");
            }

            const quizData = quizSnapshot.data();

            if (quizData.status !== "published") {
                throw new Error("This quiz is not published.");
            }

            const quizTitle = quizData.title || "Quiz";

            const passingScore = Number(quizData.passingScore || 0);

            /*
             * ------------------------------------------------------------
             * 3. Get protected questions
             * ------------------------------------------------------------
             *
             * IMPORTANT:
             * These are the ADMIN questions.
             *
             * publicQuestions does NOT contain correctAnswer.
             */

            const questionsSnapshot = await db
                .collection("questions")
                .where("quizId", "==", quizId)
                .get();

            if (questionsSnapshot.empty) {
                throw new Error("This quiz has no questions.");
            }

            /*
             * ------------------------------------------------------------
             * 4. Calculate result
             * ------------------------------------------------------------
             */

            let totalMarks = 0;
            let score = 0;

            let correctCount = 0;
            let wrongCount = 0;
            let unansweredCount = 0;

            questionsSnapshot.forEach((questionDocument) => {
                const question = questionDocument.data();

                const questionId =
                    question.questionId || questionDocument.id;

                const marks = Number(question.marks || 1);

                const correctAnswer =
                    question.correctAnswer;

                totalMarks += marks;

                const studentAnswer = answers[questionId];

                /*
                 * No answer selected.
                 */
                if (
                    studentAnswer === undefined ||
                    studentAnswer === null ||
                    String(studentAnswer).trim() === ""
                ) {
                    unansweredCount++;
                    return;
                }

                /*
                 * Correct answer.
                 */
                if (
                    String(studentAnswer).trim() ===
                    String(correctAnswer).trim()
                ) {
                    score += marks;
                    correctCount++;
                } else {
                    /*
                     * Answered but incorrect.
                     */
                    wrongCount++;
                }
            });

            /*
             * ------------------------------------------------------------
             * 5. Calculate percentage
             * ------------------------------------------------------------
             */

            const percentage =
                totalMarks > 0
                    ? Number(((score / totalMarks) * 100).toFixed(2))
                    : 0;

            /*
             * ------------------------------------------------------------
             * 6. Pass / Fail
             * ------------------------------------------------------------
             */

            const passed =
                percentage >= passingScore;

            /*
             * ------------------------------------------------------------
             * 7. Save trusted result
             * ------------------------------------------------------------
             */

            await attemptRef.set(
                {
                    status: "scored",

                    quizId: quizId,
                    quizTitle: quizTitle,
                    userId: userId,

                    score: score,
                    totalMarks: totalMarks,
                    percentage: percentage,

                    correctCount: correctCount,
                    wrongCount: wrongCount,
                    unansweredCount: unansweredCount,

                    passingScore: passingScore,
                    passed: passed,

                    timeUp: timeUp,

                    scoredAt: new Date(),
                },
                { merge: true }
            );

            logger.info("Quiz attempt scored successfully.", {
                attemptId: attemptId,
                quizId: quizId,
                userId: userId,
                score: score,
                totalMarks: totalMarks,
                percentage: percentage,
                passed: passed,
            });
        } catch (error) {
            logger.error("Quiz scoring failed.", {
                attemptId: attemptId,
                error: error.message,
            });

            await attemptRef.set(
                {
                    status: "scoring_failed",
                    errorMessage:
                        error.message || "Unable to calculate result.",
                },
                { merge: true }
            );
        }
    }
);