export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow rounded-lg p-8 w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          Verify your email
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          A verification link has been sent to your email address. Please check
          your inbox and click the link to activate your account.
        </p>
        <a href="/login" className="text-sm text-blue-600 hover:underline">
          Back to sign in
        </a>
      </div>
    </div>
  );
}
