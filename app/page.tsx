"use client"

import { useState } from "react"
import { LoginForm } from "@/components/auth/login-form"
import { SimpleEvaluationForm } from "@/components/simple-evaluation-form"
import { AuthProvider, useAuth } from "@/contexts/auth-context"
import type { EvaluationResult } from "@/lib/validation-service"
import { ResultPage } from "@/components/result-page"

function AppContent() {
  const { isAuthenticated } = useAuth()
  const [currentView, setCurrentView] = useState<"form" | "result">("form")
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null)

  if (!isAuthenticated) {
    return <LoginForm />
  }

  const handleEvaluationComplete = (result: EvaluationResult) => {
    setEvaluationResult(result)
    setCurrentView("result")
  }

  const handleBackToForm = () => {
    setCurrentView("form")
    setEvaluationResult(null)
  }

  return (
    <div className="min-h-screen bg-background">
      {currentView === "form" ? (
        <SimpleEvaluationForm onEvaluationComplete={handleEvaluationComplete} />
      ) : (
        <ResultPage result={evaluationResult!} onBackToForm={handleBackToForm} />
      )}
    </div>
  )
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
