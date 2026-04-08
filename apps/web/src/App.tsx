import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { router } from './router';
import { AuthProvider } from './context/AuthContext';
import './i18n'; // initialize i18n

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-surface-200)',
            boxShadow: '0 4px 16px rgb(0 0 0 / 0.08)',
          },
          success: {
            iconTheme: {
              primary: 'var(--color-primary-600)',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--color-error-500)',
              secondary: '#fff',
            },
          },
        }}
      />
    </AuthProvider>
  );
}

export default App;