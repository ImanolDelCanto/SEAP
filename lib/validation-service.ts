export interface ClienteData {
  nombre: string
  apellido: string
  dni: string
  sueldoNeto: number
  tipoEmpleado: "publico" | "privado" | "jubilado" | ""
  provincia: string
  bancoPagador: string
  numeroCuenta?: string
}

export interface ValidationResult {
  success: boolean
  message: string
  details?: any
}

export interface EvaluationResult {
  resultado: "aprobado" | "rechazado" | "pendiente"
  montoMaximo?: number
  motivoRechazo?: string
  detalles: {
    protecap: ValidationResult
    bcra: ValidationResult
    banco: ValidationResult
    montoCalculado?: number
  }
}

import { BCRAService, type BCRAResponse } from "./bcra-service"

// Mock data para simulaciones
const clientesMorosos = [
  { dni: "12345678", tieneCredito: true, montoDeuda: 50000 },
  { dni: "87654321", tieneCredito: false, montoDeuda: 0 },
  { dni: "11223344", tieneCredito: true, montoDeuda: 25000 },
]

const bancosHabilitados = [
  { id: "nacion", nombre: "Banco Nación", restricciones: false, situacion: 1, requiereCuenta: false },
  { id: "macro", nombre: "Banco Macro", restricciones: true, situacion: 2, requiereCuenta: true },
  { id: "santander", nombre: "Banco Santander", restricciones: false, situacion: 2, requiereCuenta: false },
  { id: "galicia", nombre: "Banco Galicia", restricciones: false, situacion: 2, requiereCuenta: false },
  { id: "bbva", nombre: "BBVA", restricciones: true, situacion: 3, requiereCuenta: false },
  { id: "icbc", nombre: "ICBC", restricciones: false, situacion: 1, requiereCuenta: false },
  { id: "supervielle", nombre: "Banco Supervielle", restricciones: false, situacion: 2, requiereCuenta: false },
]

const provinciasHabilitadas = [
  "Buenos Aires",
  "CABA",
  "Córdoba",
  "Santa Fe",
  "Mendoza",
  "Tucumán",
  "Entre Ríos",
  "Salta",
  "Misiones",
  "Chaco",
  "Corrientes",
  "Santiago del Estero",
  "San Juan",
  "Jujuy",
  "Río Negro",
]

export class ValidationService {
  static validateSueldoMinimo(sueldoNeto: number): ValidationResult {
    if (sueldoNeto < 500000) {
      return {
        success: false,
        message: "Sueldo insuficiente. Mínimo requerido: $500.000",
        details: { sueldoMinimo: 500000, sueldoActual: sueldoNeto },
      }
    }

    return {
      success: true,
      message: "Sueldo cumple requisitos mínimos",
      details: { sueldoActual: sueldoNeto },
    }
  }

  // Validación 1: Base Protecap (sin cambios - ya sigue el diagrama)
  static async validateProtecap(dni: string): Promise<ValidationResult> {
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const cliente = clientesMorosos.find((c) => c.dni === dni)

    if (cliente?.tieneCredito) {
      return {
        success: false,
        message: "Cliente con crédito activo en base Protecap",
        details: { montoDeuda: cliente.montoDeuda },
      }
    }

    return {
      success: true,
      message: "Cliente sin créditos activos en Protecap",
      details: { montoDeuda: 0 },
    }
  }

  static async validateBCRA(
    dni: string,
  ): Promise<ValidationResult & { situacion5?: boolean; porcentajeProblematicas?: number }> {
    try {
      const cuit = BCRAService.validateCuit(dni) ? dni : BCRAService.dniToCuit(dni)
      let bcraResponse: BCRAResponse

      try {
        bcraResponse = await BCRAService.consultarDeudas(cuit)
      } catch (error) {
        const errorMessage = (error as Error).message

        if (errorMessage === "TOKEN_NOT_CONFIGURED") {
          console.warn("Token BCRA no configurado, usando simulación")
          bcraResponse = BCRAService.generateMockResponse(cuit)
        } else {
          return {
            success: false,
            message: "Error técnico en consulta BCRA - Pendiente revisión manual",
            details: { error: errorMessage, requiresManualReview: true },
          }
        }
      }

      // Paso 1: Verificar situación 5 (inhabilitado)
      const situacion5 = bcraResponse.inhabilitado || bcraResponse.resumen.situacion5 > 0

      // Paso 2: Calcular porcentaje de situaciones problemáticas (3, 4, 5)
      const totalProblematicas =
        bcraResponse.resumen.situacion3 + bcraResponse.resumen.situacion4 + bcraResponse.resumen.situacion5
      const porcentajeProblematicas =
        bcraResponse.resumen.totalEntidades > 0 ? (totalProblematicas / bcraResponse.resumen.totalEntidades) * 100 : 0

      // Según diagrama: si tiene 40% o más de sit. 3, 4, o 5 = Rechazado
      if (porcentajeProblematicas >= 40) {
        return {
          success: false,
          message: `Porcentaje alto de situaciones problemáticas: ${porcentajeProblematicas.toFixed(1)}%`,
          details: { bcraData: bcraResponse, porcentajeProblematicas, totalProblematicas },
          situacion5,
          porcentajeProblematicas,
        }
      }

      return {
        success: true,
        message: `Situación BCRA favorable: ${porcentajeProblematicas.toFixed(1)}% situaciones problemáticas`,
        details: {
          bcraData: bcraResponse,
          porcentajeProblematicas,
          totalEntidades: bcraResponse.resumen.totalEntidades,
        },
        situacion5,
        porcentajeProblematicas,
      }
    } catch (error) {
      return {
        success: false,
        message: "Error técnico en validación BCRA",
        details: { error: "unexpected_error", requiresManualReview: true },
      }
    }
  }

  static async validateBanco(clienteData: ClienteData): Promise<ValidationResult> {
    await new Promise((resolve) => setTimeout(resolve, 800))

    const banco = bancosHabilitados.find((b) => b.id === clienteData.bancoPagador)

    if (!banco) {
      return {
        success: false,
        message: "Banco no habilitado",
        details: {},
      }
    }

    // Según diagrama: Banco Macro + Empleado Privado = Rechazado
    if (banco.id === "macro" && clienteData.tipoEmpleado === "privado") {
      return {
        success: false,
        message: "Banco Macro no acepta empleados privados",
        details: { banco },
      }
    }

    // Validar restricciones por sueldo (bancos con restricciones requieren >650.000)
    if (banco.restricciones && clienteData.sueldoNeto <= 650000) {
      return {
        success: false,
        message: `${banco.nombre} requiere sueldo superior a $650.000`,
        details: { banco, requiredSalary: 650000 },
      }
    }

    // Según diagrama: Situación 4 o 5 = Rechazado
    if (banco.situacion >= 4) {
      return {
        success: false,
        message: `${banco.nombre} en situación ${banco.situacion} - No habilitado`,
        details: { banco },
      }
    }

    // Validar número de cuenta para Banco Macro
    if (banco.requiereCuenta && (!clienteData.numeroCuenta || clienteData.numeroCuenta.trim() === "")) {
      return {
        success: false,
        message: `${banco.nombre} requiere número de cuenta`,
        details: { banco },
      }
    }

    // Simular validación de cuenta bloqueada para Banco Macro
    if (banco.id === "macro" && clienteData.numeroCuenta && Math.random() < 0.1) {
      return {
        success: false,
        message: "Cuenta bancaria bloqueada",
        details: { banco, accountBlocked: true },
      }
    }

    return {
      success: true,
      message: `${banco.nombre} habilitado`,
      details: { banco },
    }
  }

  static calculateMaxAmount(
    clienteData: ClienteData,
    bcraResult: ValidationResult & { situacion5?: boolean },
    bancoResult: ValidationResult,
  ): number {
    const { sueldoNeto, tipoEmpleado } = clienteData
    const banco = bancoResult.details?.banco
    const situacion5 = bcraResult.situacion5

    // Si tiene situación 5: Máximo 100.000 (según diagrama)
    if (situacion5) {
      return 100000
    }

    // Calificación final según tabla del diagrama
    let montoMaximo = 0

    if (sueldoNeto > 1000000) {
      // Sueldo superior a 1.000.000
      if (tipoEmpleado === "publico" || tipoEmpleado === "jubilado") {
        montoMaximo = 200000
      } else if (tipoEmpleado === "privado") {
        montoMaximo = 150000
      }
    } else if (sueldoNeto > 800000) {
      // Sueldo superior a 800.000
      if (tipoEmpleado === "publico" || tipoEmpleado === "jubilado") {
        montoMaximo = 150000
      } else if (tipoEmpleado === "privado") {
        montoMaximo = 100000
      }
    } else if (sueldoNeto > 500000) {
      // Sueldo superior a 500.000
      montoMaximo = 100000 // Tanto público como privado
    }

    // Ajuste por situación del banco pagador
    if (banco?.situacion === 3) {
      // Banco pagador máximo en situación 3: Máximo 150.000
      montoMaximo = Math.min(montoMaximo, 150000)
    }

    return montoMaximo
  }

  static async evaluateCliente(clienteData: ClienteData): Promise<EvaluationResult> {
    // PRIMERA PÁGINA - Validaciones automáticas

    // 1. Validar sueldo mínimo
    const sueldoValidation = this.validateSueldoMinimo(clienteData.sueldoNeto)
    if (!sueldoValidation.success) {
      return {
        resultado: "rechazado",
        motivoRechazo: sueldoValidation.message,
        detalles: {
          protecap: { success: false, message: "No evaluado" },
          bcra: { success: false, message: "No evaluado" },
          banco: { success: false, message: "No evaluado" },
        },
      }
    }

    // 2. Validación Protecap
    const protecapResult = await this.validateProtecap(clienteData.dni)
    if (!protecapResult.success) {
      return {
        resultado: "rechazado",
        motivoRechazo: protecapResult.message,
        detalles: {
          protecap: protecapResult,
          bcra: { success: false, message: "No evaluado" },
          banco: { success: false, message: "No evaluado" },
        },
      }
    }

    // 3. Validación BCRA
    const bcraResult = await this.validateBCRA(clienteData.dni)
    if (!bcraResult.success) {
      // Si es error técnico, marcar como pendiente
      if (bcraResult.details?.requiresManualReview) {
        return {
          resultado: "pendiente",
          motivoRechazo: bcraResult.message,
          detalles: {
            protecap: protecapResult,
            bcra: bcraResult,
            banco: { success: false, message: "No evaluado" },
          },
        }
      } else {
        // Si es rechazo por 40% situaciones problemáticas
        return {
          resultado: "rechazado",
          motivoRechazo: bcraResult.message,
          detalles: {
            protecap: protecapResult,
            bcra: bcraResult,
            banco: { success: false, message: "No evaluado" },
          },
        }
      }
    }

    // SEGUNDA PÁGINA - Validaciones adicionales

    // 4. Validación Banco
    const bancoResult = await this.validateBanco(clienteData)
    if (!bancoResult.success) {
      return {
        resultado: "rechazado",
        motivoRechazo: bancoResult.message,
        detalles: {
          protecap: protecapResult,
          bcra: bcraResult,
          banco: bancoResult,
        },
      }
    }

    // CALIFICACIÓN FINAL
    const montoMaximo = this.calculateMaxAmount(clienteData, bcraResult, bancoResult)

    return {
      resultado: "aprobado",
      montoMaximo,
      detalles: {
        protecap: protecapResult,
        bcra: bcraResult,
        banco: bancoResult,
        montoCalculado: montoMaximo,
      },
    }
  }

  static getBancosHabilitados() {
    return bancosHabilitados
  }

  static getProvinciasHabilitadas() {
    return provinciasHabilitadas
  }
}
