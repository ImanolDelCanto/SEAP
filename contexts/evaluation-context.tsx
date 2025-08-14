"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface ClienteData {
  // Datos básicos
  nombre: string
  apellido: string
  dni: string
  sueldoNeto: number

  // Datos laborales
  tipoEmpleado: "publico" | "privado" | "jubilado" | ""
  provincia: string
  bancoPagador: string
  numeroCuenta?: string

  // Resultados de validaciones
  bcraStatus?: "pending" | "approved" | "rejected"
  bcraData?: any
  protecapStatus?: "approved" | "rejected"

  // Resultado final
  resultado?: "aprobado" | "rechazado" | "pendiente"
  montoMaximo?: number
  motivoRechazo?: string
}

interface EvaluationContextType {
  clienteData: ClienteData
  currentStep: number
  updateClienteData: (data: Partial<ClienteData>) => void
  nextStep: () => void
  prevStep: () => void
  resetEvaluation: () => void
  setStep: (step: number) => void
}

const EvaluationContext = createContext<EvaluationContextType | undefined>(undefined)

const initialClienteData: ClienteData = {
  nombre: "",
  apellido: "",
  dni: "",
  sueldoNeto: 0,
  tipoEmpleado: "",
  provincia: "",
  bancoPagador: "",
}

export function EvaluationProvider({ children }: { children: ReactNode }) {
  const [clienteData, setClienteData] = useState<ClienteData>(initialClienteData)
  const [currentStep, setCurrentStep] = useState(1)

  const updateClienteData = (data: Partial<ClienteData>) => {
    setClienteData((prev) => ({ ...prev, ...data }))
  }

  const nextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 5))
  }

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const resetEvaluation = () => {
    setClienteData(initialClienteData)
    setCurrentStep(1)
  }

  const setStep = (step: number) => {
    setCurrentStep(Math.max(1, Math.min(step, 5)))
  }

  return (
    <EvaluationContext.Provider
      value={{
        clienteData,
        currentStep,
        updateClienteData,
        nextStep,
        prevStep,
        resetEvaluation,
        setStep,
      }}
    >
      {children}
    </EvaluationContext.Provider>
  )
}

export function useEvaluation() {
  const context = useContext(EvaluationContext)
  if (context === undefined) {
    throw new Error("useEvaluation must be used within an EvaluationProvider")
  }
  return context
}
