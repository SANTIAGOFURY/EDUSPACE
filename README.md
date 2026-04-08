
```
eduspace
├─ .npmrc
├─ apps
│  └─ web
│     ├─ eslint.config.js
│     ├─ index.html
│     ├─ package.json
│     ├─ public
│     │  ├─ favicon.svg
│     │  └─ icons.svg
│     ├─ README.md
│     ├─ src
│     │  ├─ App.css
│     │  ├─ App.tsx
│     │  ├─ assets
│     │  ├─ components
│     │  │  ├─ charts
│     │  │  │  ├─ Heatmap.tsx
│     │  │  │  ├─ index.tsx
│     │  │  │  ├─ ProgressBar.tsx
│     │  │  │  └─ RadarChart.tsx
│     │  │  ├─ common
│     │  │  │  ├─ Avatar.tsx
│     │  │  │  ├─ Badge.tsx
│     │  │  │  ├─ Button.tsx
│     │  │  │  ├─ index.tsx
│     │  │  │  ├─ Input.tsx
│     │  │  │  └─ Modal.tsx
│     │  │  ├─ content
│     │  │  │  ├─ index.tsx
│     │  │  │  ├─ PDFViewer.tsx
│     │  │  │  ├─ ProtectedViewer.tsx
│     │  │  │  └─ RichText.tsx
│     │  │  └─ forms
│     │  │     ├─ FieldRenderer.tsx
│     │  │     ├─ FormBuilder.tsx
│     │  │     └─ index.tsx
│     │  ├─ context
│     │  │  ├─ AuthContext.tsx
│     │  │  ├─ index.tsx
│     │  │  └─ ThemeContext.tsx
│     │  ├─ hooks
│     │  │  ├─ index.ts
│     │  │  ├─ useAuth.ts
│     │  │  ├─ useTheme.ts
│     │  │  └─ useToast.ts
│     │  ├─ i18n
│     │  │  ├─ index.ts
│     │  │  └─ locales
│     │  │     ├─ ar
│     │  │     │  └─ common.json
│     │  │     ├─ en
│     │  │     │  └─ common.json
│     │  │     └─ fr
│     │  │        └─ common.json
│     │  ├─ main.tsx
│     │  ├─ pages
│     │  │  ├─ auth
│     │  │  │  ├─ ForgotPassword.tsx
│     │  │  │  ├─ index.tsx
│     │  │  │  ├─ Login.tsx
│     │  │  │  └─ Register.tsx
│     │  │  ├─ open
│     │  │  │  ├─ About.tsx
│     │  │  │  ├─ Contact.tsx
│     │  │  │  ├─ Home.tsx
│     │  │  │  └─ Services.tsx
│     │  │  ├─ student
│     │  │  │  ├─ index.tsx
│     │  │  │  ├─ MyCourses.tsx
│     │  │  │  ├─ Quizzes.tsx
│     │  │  │  ├─ Requests.tsx
│     │  │  │  └─ StudentHome.tsx
│     │  │  └─ teacher
│     │  │     ├─ Classes.tsx
│     │  │     ├─ Courses.tsx
│     │  │     ├─ Dashboard.tsx
│     │  │     ├─ index.tsx
│     │  │     └─ Students.tsx
│     │  ├─ router
│     │  │  ├─ guards.tsx
│     │  │  └─ index.tsx
│     │  ├─ services
│     │  │  ├─ api.ts
│     │  │  ├─ brevo.ts
│     │  │  ├─ firebase.ts
│     │  │  └─ index.ts
│     │  ├─ store
│     │  │  ├─ authSlice.ts
│     │  │  ├─ courseSlice.ts
│     │  │  ├─ index.ts
│     │  │  └─ uiSlice.ts
│     │  ├─ styles
│     │  │  ├─ globals.css
│     │  │  └─ tailwind-base.css
│     │  ├─ types
│     │  │  └─ index.ts
│     │  └─ utils
│     │     ├─ formatters.ts
│     │     ├─ helpers.ts
│     │     ├─ index.ts
│     │     └─ validators.ts
│     ├─ tsconfig.app.json
│     ├─ tsconfig.json
│     ├─ tsconfig.node.json
│     └─ vite.config.ts
├─ firebase-debug.log
├─ firestore.indexes.json
├─ firestore.rules
├─ functions
│  ├─ .eslintrc.js
│  ├─ package.json
│  ├─ src
│  │  ├─ auth
│  │  │  └─ index.ts
│  │  ├─ email
│  │  │  └─ index.ts
│  │  ├─ index.ts
│  │  ├─ notifications
│  │  │  └─ index.ts
│  │  ├─ reports
│  │  │  └─ index.ts
│  │  └─ storage
│  │     └─ index.ts
│  ├─ tsconfig.dev.json
│  └─ tsconfig.json
├─ package.json
├─ packages
│  ├─ config
│  │  ├─ eslint-config
│  │  │  ├─ index.js
│  │  │  └─ package.json
│  │  ├─ tailwind-config
│  │  │  ├─ index.ts
│  │  │  └─ package.json
│  │  └─ typescript-config
│  │     ├─ base.json
│  │     ├─ package.json
│  │     └─ react.json
│  ├─ firebase
│  │  ├─ package.json
│  │  ├─ src
│  │  │  ├─ auth.ts
│  │  │  ├─ firestore.ts
│  │  │  ├─ index.ts
│  │  │  ├─ messaging.ts
│  │  │  └─ storage.ts
│  │  └─ tsconfig.json
│  ├─ types
│  │  ├─ package.json
│  │  ├─ src
│  │  │  ├─ course.ts
│  │  │  ├─ exercise.ts
│  │  │  ├─ form.ts
│  │  │  ├─ index.ts
│  │  │  ├─ quiz.ts
│  │  │  ├─ request.ts
│  │  │  └─ user.ts
│  │  └─ tsconfig.json
│  └─ ui
│     ├─ package.json
│     ├─ src
│     │  └─ index.ts
│     └─ tsconfig.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
├─ project-tree.txt
├─ README.md
├─ tsconfig.json
└─ turbo.json

```
```
eduspace
├─ .npmrc
├─ apps
│  └─ web
│     ├─ eslint.config.js
│     ├─ index.html
│     ├─ package.json
│     ├─ public
│     ├─ README.md
│     ├─ src
│     │  ├─ App.css
│     │  ├─ App.tsx
│     │  ├─ assets
│     │  ├─ components
│     │  │  ├─ charts
│     │  │  │  ├─ Heatmap.tsx
│     │  │  │  ├─ index.tsx
│     │  │  │  ├─ ProgressBar.tsx
│     │  │  │  └─ RadarChart.tsx
│     │  │  ├─ common
│     │  │  │  ├─ Avatar.tsx
│     │  │  │  ├─ Badge.tsx
│     │  │  │  ├─ Button.tsx
│     │  │  │  ├─ index.tsx
│     │  │  │  ├─ Input.tsx
│     │  │  │  ├─ LanguageSwitcher.tsx
│     │  │  │  └─ Modal.tsx
│     │  │  ├─ content
│     │  │  │  ├─ index.tsx
│     │  │  │  ├─ PDFViewer.tsx
│     │  │  │  ├─ ProtectedViewer.tsx
│     │  │  │  └─ RichText.tsx
│     │  │  └─ forms
│     │  │     ├─ FieldRenderer.tsx
│     │  │     ├─ FormBuilder.tsx
│     │  │     └─ index.tsx
│     │  ├─ context
│     │  │  ├─ AuthContext.tsx
│     │  │  ├─ index.tsx
│     │  │  └─ ThemeContext.tsx
│     │  ├─ features
│     │  │  └─ auth
│     │  │     ├─ ForgotPasswordModal.tsx
│     │  │     ├─ GoogleCompleteProfileModal.tsx
│     │  │     ├─ LoginForm.tsx
│     │  │     └─ RegisterForm.tsx
│     │  ├─ hooks
│     │  │  ├─ index.ts
│     │  │  ├─ useAuth.ts
│     │  │  ├─ useTheme.ts
│     │  │  └─ useToast.ts
│     │  ├─ i18n
│     │  │  ├─ index.ts
│     │  │  └─ locales
│     │  │     ├─ ar
│     │  │     │  └─ common.json
│     │  │     ├─ en
│     │  │     │  └─ common.json
│     │  │     └─ fr
│     │  │        └─ common.json
│     │  ├─ main.tsx
│     │  ├─ pages
│     │  │  ├─ auth
│     │  │  │  └─ AuthPage.tsx
│     │  │  ├─ open
│     │  │  │  ├─ About.tsx
│     │  │  │  ├─ Contact.tsx
│     │  │  │  ├─ Home.tsx
│     │  │  │  └─ Services.tsx
│     │  │  ├─ student
│     │  │  │  ├─ index.tsx
│     │  │  │  ├─ MyCourses.tsx
│     │  │  │  ├─ Quizzes.tsx
│     │  │  │  ├─ Requests.tsx
│     │  │  │  └─ StudentHome.tsx
│     │  │  └─ teacher
│     │  │     ├─ Classes.tsx
│     │  │     ├─ Courses.tsx
│     │  │     ├─ Dashboard.tsx
│     │  │     ├─ index.tsx
│     │  │     └─ Students.tsx
│     │  ├─ router
│     │  │  ├─ guards.tsx
│     │  │  └─ index.tsx
│     │  ├─ services
│     │  │  ├─ api.ts
│     │  │  ├─ brevo.ts
│     │  │  ├─ firebase.ts
│     │  │  └─ index.ts
│     │  ├─ store
│     │  │  ├─ authSlice.ts
│     │  │  ├─ courseSlice.ts
│     │  │  ├─ index.ts
│     │  │  └─ uiSlice.ts
│     │  ├─ styles
│     │  │  ├─ globals.css
│     │  │  └─ tailwind-base.css
│     │  ├─ types
│     │  │  └─ index.ts
│     │  └─ utils
│     │     ├─ formatters.ts
│     │     ├─ helpers.ts
│     │     ├─ index.ts
│     │     └─ validators.ts
│     ├─ tsconfig.app.json
│     ├─ tsconfig.json
│     ├─ tsconfig.node.json
│     └─ vite.config.ts
├─ firestore.indexes.json
├─ firestore.rules
├─ functions
│  ├─ .eslintrc.js
│  ├─ package.json
│  ├─ src
│  │  ├─ auth
│  │  │  ├─ checkAuthorizedUser.ts
│  │  │  ├─ completeProfile.ts
│  │  │  ├─ index.ts
│  │  │  ├─ onUserCreate.ts
│  │  │  └─ validateSignup.ts
│  │  ├─ email
│  │  │  └─ index.ts
│  │  ├─ helpers.ts
│  │  ├─ index.ts
│  │  ├─ notifications
│  │  │  └─ index.ts
│  │  ├─ reports
│  │  │  └─ index.ts
│  │  ├─ storage
│  │  │  └─ index.ts
│  │  └─ utils
│  │     ├─ idGenerator.ts
│  │     └─ index.ts
│  ├─ tsconfig.dev.json
│  └─ tsconfig.json
├─ package.json
├─ packages
│  ├─ config
│  │  ├─ eslint-config
│  │  │  ├─ index.js
│  │  │  └─ package.json
│  │  ├─ tailwind-config
│  │  │  ├─ index.ts
│  │  │  └─ package.json
│  │  └─ typescript-config
│  │     ├─ base.json
│  │     ├─ package.json
│  │     └─ react.json
│  ├─ firebase
│  │  ├─ package.json
│  │  ├─ src
│  │  │  ├─ auth.ts
│  │  │  ├─ firestore.ts
│  │  │  ├─ index.ts
│  │  │  ├─ messaging.ts
│  │  │  └─ storage.ts
│  │  └─ tsconfig.json
│  ├─ types
│  │  ├─ package.json
│  │  ├─ src
│  │  │  ├─ course.ts
│  │  │  ├─ exercise.ts
│  │  │  ├─ form.ts
│  │  │  ├─ index.ts
│  │  │  ├─ quiz.ts
│  │  │  ├─ request.ts
│  │  │  └─ user.ts
│  │  └─ tsconfig.json
│  └─ ui
│     ├─ package.json
│     ├─ src
│     │  └─ index.ts
│     └─ tsconfig.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
├─ project-tree.txt
├─ README.md
├─ tsconfig.json
└─ turbo.json

```