"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface Comercializador {
  id: number
  email: string
  nombre: string
}

interface AuthContextType {
  user: Comercializador | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Mock data para comercializadores
const comercializadores: Comercializador[] = [
  { id: 1, email: "juan@comercial.com", nombre: "Juan Pérez" },
  { id: 2, email: "maria@comercial.com", nombre: "María García" },
  { id: 3, email: "admin@seap.com", nombre: "Administrador SEAP" },
]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Comercializador | null>(null)

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simular delay de autenticación
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Validación simple - en producción sería contra API real
    const foundUser = comercializadores.find((c) => c.email === email)
    if (foundUser && password === "123456") {
      setUser(foundUser)
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
