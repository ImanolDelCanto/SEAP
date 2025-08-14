"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ValidationService, type ClienteData, type EvaluationResult } from "@/lib/validation-service"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"

interface SimpleEvaluationFormProps {
  onEvaluationComplete: (result: EvaluationResult) => void
}

export function SimpleEvaluationForm({ onEvaluationComplete }: SimpleEvaluationFormProps) {
  const { user, logout } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<ClienteData>({
    nombre: "",
    apellido: "",
    dni: "",
    sueldoNeto: 0,
    tipoEmpleado: "",
    provincia: "",
    bancoPagador: "",
    numeroCuenta: "",
  })

  const handleInputChange = (field: keyof ClienteData, value: string | number) => {
    console.log(`📝 Form: Campo ${field} actualizado:`, value)
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log(`🚀 Form: Iniciando evaluación del cliente`)
    console.log(`📊 Datos del formulario:`, {
      ...formData,
      numeroCuenta: formData.numeroCuenta ? '***' + formData.numeroCuenta.slice(-4) : undefined
    })
    
    setIsLoading(true)

    try {
      const startTime = Date.now()
      const result = await ValidationService.evaluateCliente(formData)
      const endTime = Date.now()
      
      console.log(`✅ Form: Evaluación completada en ${endTime - startTime}ms`)
      console.log(`📋 Resultado:`, {
        resultado: result.resultado,
        montoMaximo: result.montoMaximo,
        motivoRechazo: result.motivoRechazo
      })
      
      onEvaluationComplete(result)
    } catch (error) {
      console.error("💥 Form: Error en evaluación:", error)
      
      // Mostrar un resultado de error al usuario
      const errorResult: EvaluationResult = {
        resultado: "pendiente",
        motivoRechazo: "Error técnico durante la evaluación. Intente nuevamente.",
        detalles: {
          protecap: { success: false, message: "Error técnico" },
          bcra: { success: false, message: "Error técnico" },
          banco: { success: false, message: "Error técnico" },
        }
      }
      onEvaluationComplete(errorResult)
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid =
    formData.nombre &&
    formData.apellido &&
    formData.dni &&
    formData.sueldoNeto > 0 &&
    formData.tipoEmpleado &&
    formData.provincia &&
    formData.bancoPagador

  // Log cuando el formulario esté válido
  if (isFormValid && !isLoading) {
    console.log(`✅ Form: Formulario válido, listo para enviar`)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">SEAP</h1>
          <p className="text-muted-foreground">Evaluación de Préstamos</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Comercializador: {user?.nombre}</span>
          <Button variant="outline" onClick={logout}>
            Cerrar Sesión
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Datos Personales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => handleInputChange("nombre", e.target.value)}
                  placeholder="Ingrese el nombre"
                  required
                />
              </div>
              <div>
                <Label htmlFor="apellido">Apellido</Label>
                <Input
                  id="apellido"
                  value={formData.apellido}
                  onChange={(e) => handleInputChange("apellido", e.target.value)}
                  placeholder="Ingrese el apellido"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dni">DNI</Label>
                <Input
                  id="dni"
                  value={formData.dni}
                  onChange={(e) => handleInputChange("dni", e.target.value)}
                  placeholder="12345678"
                  required
                />
              </div>
              <div>
                <Label htmlFor="provincia">Provincia</Label>
                <Select onValueChange={(value) => handleInputChange("provincia", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione provincia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buenos-aires">Buenos Aires</SelectItem>
                    <SelectItem value="cordoba">Córdoba</SelectItem>
                    <SelectItem value="santa-fe">Santa Fe</SelectItem>
                    <SelectItem value="mendoza">Mendoza</SelectItem>
                    <SelectItem value="tucuman">Tucumán</SelectItem>
                    <SelectItem value="entre-rios">Entre Ríos</SelectItem>
                    <SelectItem value="salta">Salta</SelectItem>
                    <SelectItem value="chaco">Chaco</SelectItem>
                    <SelectItem value="corrientes">Corrientes</SelectItem>
                    <SelectItem value="misiones">Misiones</SelectItem>
                    <SelectItem value="san-juan">San Juan</SelectItem>
                    <SelectItem value="jujuy">Jujuy</SelectItem>
                    <SelectItem value="rio-negro">Río Negro</SelectItem>
                    <SelectItem value="formosa">Formosa</SelectItem>
                    <SelectItem value="neuquen">Neuquén</SelectItem>
                    <SelectItem value="chubut">Chubut</SelectItem>
                    <SelectItem value="san-luis">San Luis</SelectItem>
                    <SelectItem value="catamarca">Catamarca</SelectItem>
                    <SelectItem value="la-rioja">La Rioja</SelectItem>
                    <SelectItem value="la-pampa">La Pampa</SelectItem>
                    <SelectItem value="santiago-del-estero">Santiago del Estero</SelectItem>
                    <SelectItem value="santa-cruz">Santa Cruz</SelectItem>
                    <SelectItem value="tierra-del-fuego">Tierra del Fuego</SelectItem>
                    <SelectItem value="caba">CABA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Datos Laborales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sueldo">Sueldo Neto</Label>
                <Input
                  id="sueldo"
                  type="number"
                  value={formData.sueldoNeto || ""}
                  onChange={(e) => handleInputChange("sueldoNeto", Number(e.target.value))}
                  placeholder="500000"
                  required
                />
              </div>
              <div>
                <Label htmlFor="tipoEmpleado">Tipo de Empleado</Label>
                <Select onValueChange={(value) => handleInputChange("tipoEmpleado", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="publico">Empleado Público</SelectItem>
                    <SelectItem value="privado">Empleado Privado</SelectItem>
                    <SelectItem value="jubilado">Jubilado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Datos Bancarios */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="banco">Banco Pagador</Label>
                <Select onValueChange={(value) => handleInputChange("bancoPagador", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nacion">Banco Nación</SelectItem>
                    <SelectItem value="macro">Banco Macro</SelectItem>
                    <SelectItem value="santander">Banco Santander</SelectItem>
                    <SelectItem value="galicia">Banco Galicia</SelectItem>
                    <SelectItem value="bbva">BBVA</SelectItem>
                    <SelectItem value="icbc">ICBC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.bancoPagador === "macro" && (
                <div>
                  <Label htmlFor="cuenta">Número de Cuenta</Label>
                  <Input
                    id="cuenta"
                    value={formData.numeroCuenta || ""}
                    onChange={(e) => handleInputChange("numeroCuenta", e.target.value)}
                    placeholder="Número de cuenta"
                    required
                  />
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={!isFormValid || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Evaluando...
                </>
              ) : (
                "Evaluar Préstamo"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
