package com.quizmaster.app.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlin.math.round

object AttemptRepository {

    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    fun submitAttempt(
        quizId: String,
        answers: Map<String, String>,
        timeUp: Boolean,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        val user = auth.currentUser

        // Check login session
        if (user == null) {
            onError("Your session has expired. Please login again.")
            return
        }

        // Check quiz ID
        if (quizId.isBlank()) {
            onError("Invalid quiz.")
            return
        }

        // First load quiz information
        db.collection("quizzes")
            .document(quizId)
            .get()
            .addOnSuccessListener { quizDocument ->

                if (!quizDocument.exists()) {
                    onError("Quiz not found.")
                    return@addOnSuccessListener
                }

                // Only published quizzes can be submitted
                val status = quizDocument.getString("status") ?: ""

                if (status != "published") {
                    onError("This quiz is not available.")
                    return@addOnSuccessListener
                }

                val quizTitle = quizDocument.getString("title")
                    ?: "Quiz"

                val passingScore = quizDocument.getLong("passingScore")
                    ?: 40L

                // Load public questions for this quiz
                db.collection("publicQuestions")
                    .whereEqualTo("quizId", quizId)
                    .get()
                    .addOnSuccessListener { questionDocuments ->

                        if (questionDocuments.isEmpty) {
                            onError("No questions found for this quiz.")
                            return@addOnSuccessListener
                        }

                        var totalMarks = 0L
                        var score = 0L
                        var correctCount = 0L
                        var wrongCount = 0L
                        var unansweredCount = 0L

                        // Calculate result question by question
                        for (document in questionDocuments.documents) {

                            val questionId = document.getString("questionId")
                                ?: document.id

                            val correctAnswer = document
                                .getString("correctAnswer")
                                ?.trim()
                                ?.uppercase()
                                ?: ""

                            val marks = document.getLong("marks")
                                ?: 1L

                            totalMarks += marks

                            val studentAnswer = answers[questionId]
                                ?.trim()
                                ?.uppercase()
                                ?: ""

                            when {
                                studentAnswer.isBlank() -> {
                                    unansweredCount++
                                }

                                studentAnswer == correctAnswer -> {
                                    score += marks
                                    correctCount++
                                }

                                else -> {
                                    wrongCount++
                                }
                            }
                        }

                        // Prevent division by zero
                        val percentage = if (totalMarks > 0L) {
                            round((score.toDouble() / totalMarks.toDouble()) * 10000.0) / 100.0
                        } else {
                            0.0
                        }

                        val passed = percentage >= passingScore.toDouble()

                        val attemptRef = db
                            .collection("attempts")
                            .document()

                        val attemptData = hashMapOf<String, Any>(
                            "attemptId" to attemptRef.id,
                            "quizId" to quizId,
                            "quizTitle" to quizTitle,
                            "userId" to user.uid,

                            // Student answers only
                            "answers" to answers,

                            // Statistics
                            "questionCount" to questionDocuments.size(),
                            "answeredCount" to answers.size,
                            "correctCount" to correctCount,
                            "wrongCount" to wrongCount,
                            "unansweredCount" to unansweredCount,

                            // Score
                            "score" to score,
                            "totalMarks" to totalMarks,
                            "percentage" to percentage,
                            "passingScore" to passingScore,
                            "passed" to passed,

                            // Submission information
                            "timeUp" to timeUp,
                            "status" to "scored",
                            "submittedAt" to FieldValue.serverTimestamp(),
                            "scoredAt" to FieldValue.serverTimestamp()
                        )

                        // Save complete result
                        attemptRef
                            .set(attemptData)
                            .addOnSuccessListener {
                                onSuccess(attemptRef.id)
                            }
                            .addOnFailureListener { exception ->
                                onError(
                                    exception.localizedMessage
                                        ?: "Failed to save quiz result."
                                )
                            }
                    }
                    .addOnFailureListener { exception ->
                        onError(
                            exception.localizedMessage
                                ?: "Failed to load quiz questions."
                        )
                    }
            }
            .addOnFailureListener { exception ->
                onError(
                    exception.localizedMessage
                        ?: "Failed to load quiz information."
                )
            }
    }
}