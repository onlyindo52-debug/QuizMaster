# QuizMaster

QuizMaster is an Android-based quiz management application that enables administrators to create and manage quizzes while allowing students to attempt timed quizzes, view results, and track their performance.

## Features

- User authentication and role-based access for Admin and Student.
- Create, edit, publish, unpublish, and delete quizzes.
- Manage quiz questions and options.
- Timed quizzes with question navigation and mark-for-review functionality.
- Automatic submission and score calculation.
- Student results, attempt history, and answer review.
- Search and filters for quizzes and results.
- Student activity and attendance tracking.
- Dark mode and application settings.

## Tech Stack

- **Language:** Kotlin
- **UI:** Jetpack Compose, Material 3
- **Authentication:** Firebase Authentication
- **Database:** Cloud Firestore
- **Local Preferences:** Jetpack DataStore
- **IDE:** Android Studio
- **Build System:** Gradle with Kotlin DSL

## Architecture

The application uses a Firebase-based backend with Android-side application logic. Firebase Authentication manages user identity, while Cloud Firestore stores user profiles, quizzes, questions, quiz attempts, and attendance records.

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/onlyindo52-debug/QuizMaster.git
   ```

2. Open the project in Android Studio.
3. Configure your Firebase project and add the required `google-services.json` file to the app module.
4. Sync the Gradle project.
5. Run the application on an Android device or emulator.

## Requirements

- Android Studio
- Compatible Android device or emulator
- Firebase project with Authentication and Cloud Firestore configured
- Internet connection for Firebase services

## Security

Firebase Authentication and Firestore Security Rules are used to manage authentication and data access. Configure appropriate production security rules before deployment. Do not commit private credentials or sensitive configuration files to a public repository.

## Project Status

Developed as a B.Sc. Computer Science academic project. The application includes quiz management, timed assessments, result tracking, and student activity features.

## License

No license has been specified yet. All rights are reserved by the repository owner unless a license is added.
