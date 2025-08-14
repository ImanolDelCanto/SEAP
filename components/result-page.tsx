"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { EvaluationResult } from "@/lib/validation-service"
import { CheckCircle, XCircle, Clock, MessageCircle, ArrowLeft } from "lucide-react"

interface ResultPageProps {
  result: EvaluationResult
  onBackToForm: () => void
}

export function ResultPage({ result, onBackToForm }: ResultPageProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(0)
  const [selectedInstallments, setSelectedInstallments] = useState<number>(0)

  const getStatusIcon = () => {
    switch (result.resultado) {
      case "aprobado":
        return <CheckCircle className="h-8 w-8 text-green-500" />
      case "rechazado":
        return <XCircle className="h-8 w-8 text-red-500" />
      case "pendiente":
        return <Clock className="h-8 w-8 text-yellow-500" />
    }
  }

  const getStatusColor = () => {
    switch (result.resultado) {
      case "aprobado":
        return "bg-green-50 border-green-200"
      case "rechazado":
        return "bg-red-50 border-red-200"
      case "pendiente":
        return "bg-yellow-50 border-yellow-200"
    }
  }

  const generateWhatsAppMessage = () => {
    if (result.resultado === "aprobado" && selectedAmount && selectedInstallments) {
      const message = `¡Hola! Tu préstamo ha sido APROBADO ✅

💰 Monto: $${selectedAmount.toLocaleString()}
📅 Cuotas: ${selectedInstallments}
💳 Cuota mensual: $${Math.round(selectedAmount / selectedInstallments).toLocaleString()}

¿Querés continuar con el trámite? Te ayudo con los próximos pasos.`

      return encodeURIComponent(message)
    } else if (result.resultado === "rechazado") {
      const message = `Hola, lamentablemente tu solicitud de préstamo no pudo ser aprobada.

❌ Motivo: ${result.motivoRechazo}

No te preocupes, podemos revisar otras opciones. ¿Te parece que conversemos?`

      return encodeURIComponent(message)
    } else {
      const message = `Hola, tu solicitud de préstamo está en revisión.

⏳ Estado: Pendiente de análisis manual
📋 Motivo: ${result.motivoRechazo}

Te contactaremos pronto con el resultado. ¿Tenés alguna consulta?`

      return encodeURIComponent(message)
    }
  }

  const amountOptions = result.montoMaximo
    ? [Math.round(result.montoMaximo * 0.5), Math.round(result.montoMaximo * 0.75), result.montoMaximo]
    : []

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" onClick={onBackToForm}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Nueva Evaluación
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">Resultado</h1>
          <p className="text-muted-foreground">Evaluación de Préstamo</p>
        </div>
      </div>

      <Card className={`mb-6 ${getStatusColor()}`}>
        <CardHeader>
          <div className="flex items-center gap-4">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-2xl">
                {result.resultado === "aprobado" && "¡APROBADO!"}
                {result.resultado === "rechazado" && "RECHAZADO"}
                {result.resultado === "pendiente" && "PENDIENTE"}
              </CardTitle>
              {result.motivoRechazo && <p className="text-muted-foreground mt-2">{result.motivoRechazo}</p>}
            </div>
          </div>
        </CardHeader>

        {result.resultado === "aprobado" && result.montoMaximo && (
          <CardContent>
            <div className="space-y-6">
              <div>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  Monto máximo: ${result.montoMaximo.toLocaleString()}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="monto">Monto a solicitar</Label>
                  <Select onValueChange={(value) => setSelectedAmount(Number(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar monto" />
                    </SelectTrigger>
                    <SelectContent>
                      {amountOptions.map((amount) => (
                        <SelectItem key={amount} value={amount.toString()}>
                          ${amount.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cuotas">Cantidad de cuotas</Label>
                  <Select onValueChange={(value) => setSelectedInstallments(Number(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cuotas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 cuotas</SelectItem>
                      <SelectItem value="6">6 cuotas</SelectItem>
                      <SelectItem value="8">8 cuotas</SelectItem>
                      <SelectItem value="10">10 cuotas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedAmount && selectedInstallments && (
                <div className="p-4 bg-white rounded-lg border">
                  <h4 className="font-semibold mb-2">Resumen del préstamo:</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Monto:</span>
                      <span className="font-medium">${selectedAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cuotas:</span>
                      <span className="font-medium">{selectedInstallments}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span>Cuota mensual:</span>
                      <span className="font-bold">
                        ${Math.round(selectedAmount / selectedInstallments).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">
              {result.resultado === "aprobado" ? "¡Continuemos con tu préstamo!" : "¿Necesitás ayuda?"}
            </h3>
            <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700"
              disabled={result.resultado === "aprobado" && (!selectedAmount || !selectedInstallments)}
              onClick={() => {
                const message = generateWhatsAppMessage()
                window.open(`https://wa.me/5491169770385?text=${message}`, "_blank")
              }}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              Contactar Asesor por WhatsApp
            </Button>
            {result.resultado === "aprobado" && (!selectedAmount || !selectedInstallments) && (
              <p className="text-sm text-muted-foreground mt-2">Seleccioná monto y cuotas para continuar</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
