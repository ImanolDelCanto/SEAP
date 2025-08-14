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

const bancosData = [
  { id: "nacion", nombre: "Banco Nación", restricciones: false, situacion: 1, requiereCuenta: false },
  { id: "macro", nombre: "Banco Macro", restricciones: true, situacion: 2, requiereCuenta: true },
  { id: "santander", nombre: "Banco Santander", restricciones: false, situacion: 1, requiereCuenta: false },
  { id: "galicia", nombre: "Banco Galicia", restricciones: false, situacion: 2, requiereCuenta: false },
  { id: "bbva", nombre: "BBVA", restricciones: true, situacion: 3, requiereCuenta: false },
  { id: "icbc", nombre: "ICBC", restricciones: false, situacion: 1, requiereCuenta: false },
]

export class ValidationService {
  // Validación 1: Base Protecap
  static async validateProtecap(dni: string): Promise<ValidationResult> {
    console.log(`🔍 ValidationService: Iniciando validación Protecap para DNI ${dni}`)
    
    // Simular delay de consulta
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const cliente = clientesMorosos.find((c) => c.dni === dni)

    if (cliente?.tieneCredito) {
      console.log(`❌ ValidationService: Cliente ${dni} encontrado en base Protecap con deuda de $${cliente.montoDeuda}`)
      return {
        success: false,
        message: "Cliente con crédito activo en base Protecap",
        details: { montoDeuda: cliente.montoDeuda },
      }
    }

    console.log(`✅ ValidationService: Cliente ${dni} sin créditos activos en Protecap`)
    return {
      success: true,
      message: "Cliente sin créditos activos en Protecap",
      details: { montoDeuda: 0 },
    }
  }

  static async validateBCRA(dni: string): Promise<ValidationResult> {
    console.log(`🏦 ValidationService: Iniciando validación BCRA para DNI ${dni}`)
    
    try {
      // Convertir DNI a CUIT si es necesario
      const cuit = BCRAService.validateCuit(dni) ? dni : BCRAService.dniToCuit(dni)
      console.log(`🔄 ValidationService: Usando CUIT ${cuit} para consulta BCRA`)

      let bcraResponse: BCRAResponse

      try {
        // Intentar consulta real a BCRA
        console.log("📡 ValidationService: Realizando consulta real a BCRA...")
        bcraResponse = await BCRAService.consultarDeudas(cuit)
        console.log("✅ ValidationService: Consulta BCRA completada exitosamente")
      } catch (error) {
        const errorMessage = (error as Error).message
        console.error(`❌ ValidationService: Error en consulta BCRA: ${errorMessage}`)

        // Manejar errores específicos
        switch (errorMessage) {
          case "TOKEN_NOT_CONFIGURED":
            console.warn("🎭 ValidationService: Token BCRA no configurado, usando simulación")
            bcraResponse = BCRAService.generateMockResponse(cuit)
            break

          case "TIMEOUT":
            console.error("⏱️ ValidationService: Timeout en consulta BCRA")
            return {
              success: false,
              message: "Timeout en consulta BCRA - Pendiente revisión manual",
              details: { error: "timeout", requiresManualReview: true },
            }

          case "MAX_RETRIES_EXCEEDED":
            console.error("🔄 ValidationService: Máximo de reintentos excedido en BCRA")
            return {
              success: false,
              message: "Error de conexión con BCRA - Pendiente revisión manual",
              details: { error: "connection_failed", requiresManualReview: true },
            }

          default:
            if (errorMessage.startsWith("HTTP_ERROR_")) {
              const statusCode = errorMessage.replace("HTTP_ERROR_", "")
              console.error(`🚫 ValidationService: Error HTTP ${statusCode} en BCRA`)
              return {
                success: false,
                message: `Error HTTP ${statusCode} en consulta BCRA - Pendiente revisión manual`,
                details: { error: "http_error", statusCode, requiresManualReview: true },
              }
            }

            // Error desconocido
            console.error("❓ ValidationService: Error desconocido en consulta BCRA")
            return {
              success: false,
              message: "Error técnico en consulta BCRA - Pendiente revisión manual",
              details: { error: "unknown", requiresManualReview: true },
            }
        }
      }

      console.log(`📊 ValidationService: Analizando resultado BCRA:`, {
        totalEntidades: bcraResponse.resumen.totalEntidades,
        inhabilitado: bcraResponse.inhabilitado,
        situacion5: bcraResponse.resumen.situacion5
      })

      // Verificar si está inhabilitado (situación 5)
      if (bcraResponse.inhabilitado) {
        console.log(`🚫 ValidationService: Cliente inhabilitado (Situación 5): ${bcraResponse.resumen.situacion5} casos`)
        return {
          success: false,
          message: "Cliente inhabilitado en BCRA (Situación 5)",
          details: {
            bcraData: bcraResponse,
            situacion5Count: bcraResponse.resumen.situacion5,
          },
        }
      }

      // Calcular porcentaje de situaciones problemáticas (3, 4, 5)
      const totalProblematicas =
        bcraResponse.resumen.situacion3 + bcraResponse.resumen.situacion4 + bcraResponse.resumen.situacion5

      const porcentajeProblematicas =
        bcraResponse.resumen.totalEntidades > 0 ? (totalProblematicas / bcraResponse.resumen.totalEntidades) * 100 : 0

      console.log(`📈 ValidationService: Análisis de situaciones problemáticas:`, {
        totalProblematicas,
        totalEntidades: bcraResponse.resumen.totalEntidades,
        porcentaje: `${porcentajeProblematicas.toFixed(1)}%`,
        montoTotal: bcraResponse.resumen.montoTotal
      })

      if (porcentajeProblematicas >= 40) {
        console.log(`❌ ValidationService: Porcentaje problemático muy alto: ${porcentajeProblematicas.toFixed(1)}%`)
        return {
          success: false,
          message: `Porcentaje alto de situaciones problemáticas: ${porcentajeProblematicas.toFixed(1)}%`,
          details: {
            bcraData: bcraResponse,
            porcentajeProblematicas,
            totalProblematicas,
          },
        }
      }

      console.log(`✅ ValidationService: BCRA favorable con ${porcentajeProblematicas.toFixed(1)}% situaciones problemáticas`)
      return {
        success: true,
        message: `Situación BCRA favorable: ${porcentajeProblematicas.toFixed(1)}% situaciones problemáticas`,
        details: {
          bcraData: bcraResponse,
          porcentajeProblematicas,
          totalEntidades: bcraResponse.resumen.totalEntidades,
          montoTotal: bcraResponse.resumen.montoTotal,
        },
      }
    } catch (error) {
      console.error("💥 ValidationService: Error inesperado en validación BCRA:", error)
      return {
        success: false,
        message: "Error técnico en validación BCRA - Pendiente revisión manual",
        details: { error: "unexpected_error", requiresManualReview: true },
      }
    }
  }

  // Validación 3: Banco Pagador
  static async validateBanco(clienteData: ClienteData): Promise<ValidationResult> {
    console.log(`🏪 ValidationService: Iniciando validación banco ${clienteData.bancoPagador}`)
    
    await new Promise((resolve) => setTimeout(resolve, 800))

    const banco = bancosData.find((b) => b.id === clienteData.bancoPagador)

    if (!banco) {
      console.error(`❌ ValidationService: Banco ${clienteData.bancoPagador} no encontrado`)
      return {
        success: false,
        message: "Banco no encontrado",
        details: {},
      }
    }

    console.log(`🏪 ValidationService: Validando ${banco.nombre}:`, {
      restricciones: banco.restricciones,
      situacion: banco.situacion,
      requiereCuenta: banco.requiereCuenta,
      sueldoCliente: clienteData.sueldoNeto,
      tipoEmpleado: clienteData.tipoEmpleado
    })

    // Validar restricciones por sueldo
    if (banco.restricciones && clienteData.sueldoNeto < 650000) {
      console.log(`❌ ValidationService: Sueldo insuficiente para ${banco.nombre}: $${clienteData.sueldoNeto} < $650.000`)
      return {
        success: false,
        message: `${banco.nombre} requiere sueldo mínimo de $650.000`,
        details: { banco, requiredSalary: 650000 },
      }
    }

    // Validar situación bancaria
    if (banco.situacion >= 4) {
      console.log(`❌ ValidationService: ${banco.nombre} en situación ${banco.situacion} - No habilitado`)
      return {
        success: false,
        message: `${banco.nombre} en situación ${banco.situacion} - No habilitado`,
        details: { banco },
      }
    }

    // Validar restricción Banco Macro + Empleado Privado
    if (banco.id === "macro" && clienteData.tipoEmpleado === "privado") {
      console.log(`❌ ValidationService: Banco Macro no acepta empleados privados`)
      return {
        success: false,
        message: "Banco Macro no acepta empleados privados",
        details: { banco },
      }
    }

    // Validar número de cuenta para Banco Macro
    if (banco.requiereCuenta && (!clienteData.numeroCuenta || clienteData.numeroCuenta.trim() === "")) {
      console.log(`❌ ValidationService: ${banco.nombre} requiere número de cuenta`)
      return {
        success: false,
        message: `${banco.nombre} requiere número de cuenta`,
        details: { banco },
      }
    }

    // Simular validación de cuenta bloqueada (5% probabilidad)
    const randomCheck = Math.random()
    if (randomCheck < 0.05) {
      console.log(`❌ ValidationService: Cuenta bancaria bloqueada (simulación)`)
      return {
        success: false,
        message: "Cuenta bancaria bloqueada",
        details: { banco, accountBlocked: true },
      }
    }

    console.log(`✅ ValidationService: ${banco.nombre} habilitado correctamente`)
    return {
      success: true,
      message: `${banco.nombre} habilitado`,
      details: { banco },
    }
  }

  // Cálculo de monto máximo según todas las reglas
  static calculateMaxAmount(
    clienteData: ClienteData,
    validationResults: { bcra: ValidationResult; banco: ValidationResult },
  ): number {
    console.log(`💰 ValidationService: Calculando monto máximo para cliente:`, {
      sueldo: clienteData.sueldoNeto,
      tipoEmpleado: clienteData.tipoEmpleado
    })

    let baseAmount = 0

    // Paso 1: Clasificación por sueldo
    if (clienteData.sueldoNeto >= 1000000) {
      baseAmount = 200000
      console.log(`💰 ValidationService: Sueldo ≥ $1.000.000 → Monto base: $${baseAmount}`)
    } else if (clienteData.sueldoNeto >= 800000) {
      baseAmount = 150000
      console.log(`💰 ValidationService: Sueldo ≥ $800.000 → Monto base: $${baseAmount}`)
    } else if (clienteData.sueldoNeto >= 500000) {
      baseAmount = 100000
      console.log(`💰 ValidationService: Sueldo ≥ $500.000 → Monto base: $${baseAmount}`)
    } else {
      console.log(`❌ ValidationService: Sueldo < $500.000 → No califica para préstamo`)
    }

    // Paso 2: Ajuste por tipo de empleado
    if (clienteData.tipoEmpleado === "publico" || clienteData.tipoEmpleado === "jubilado") {
      // Público/Jubilado: máximo $200,000
      const oldAmount = baseAmount
      baseAmount = Math.min(baseAmount, 200000)
      if (oldAmount !== baseAmount) {
        console.log(`💰 ValidationService: Ajuste empleado público/jubilado: $${oldAmount} → $${baseAmount}`)
      }
    } else if (clienteData.tipoEmpleado === "privado") {
      // Privado: máximo $150,000
      const oldAmount = baseAmount
      baseAmount = Math.min(baseAmount, 150000)
      if (oldAmount !== baseAmount) {
        console.log(`💰 ValidationService: Ajuste empleado privado: $${oldAmount} → $${baseAmount}`)
      }
    }

    // Paso 3: Ajuste por situación bancaria
    const bancoDetails = validationResults.banco.details?.banco
    if (bancoDetails?.situacion === 3) {
      // Banco situación 3: máximo $150,000
      const oldAmount = baseAmount
      baseAmount = Math.min(baseAmount, 150000)
      if (oldAmount !== baseAmount) {
        console.log(`💰 ValidationService: Ajuste banco situación 3: $${oldAmount} → $${baseAmount}`)
      }
    }

    const bcraDetails = validationResults.bcra.details
    if (bcraDetails?.porcentajeProblematicas > 20) {
      // Si tiene entre 20-40% situaciones problemáticas, reducir monto
      const oldAmount = baseAmount
      baseAmount = Math.min(baseAmount, 100000)
      if (oldAmount !== baseAmount) {
        console.log(`💰 ValidationService: Ajuste BCRA >20% problemáticas: $${oldAmount} → $${baseAmount}`)
      }
    }

    // Ajuste adicional por monto total de deudas BCRA
    if (bcraDetails?.montoTotal > 100000) {
      const oldAmount = baseAmount
      baseAmount = Math.min(baseAmount, 100000)
      if (oldAmount !== baseAmount) {
        console.log(`💰 ValidationService: Ajuste deudas BCRA >$100k: $${oldAmount} → $${baseAmount}`)
      }
    }

    console.log(`✅ ValidationService: Monto máximo final calculado: $${baseAmount}`)
    return baseAmount
  }

  // Evaluación completa
  static async evaluateCliente(clienteData: ClienteData): Promise<EvaluationResult> {
    console.log(`🎯 ValidationService: INICIANDO EVALUACIÓN COMPLETA`)
    console.log(`👤 Cliente: ${clienteData.nombre} ${clienteData.apellido} (${clienteData.dni})`)
    console.log(`💼 Datos laborales: ${clienteData.tipoEmpleado} - $${clienteData.sueldoNeto} - ${clienteData.bancoPagador}`)
    
    const startTime = Date.now()

    try {
      // Validación 1: Protecap
      console.log(`\n📋 === PASO 1: VALIDACIÓN PROTECAP ===`)
      const protecapResult = await this.validateProtecap(clienteData.dni)

      if (!protecapResult.success) {
        const result = {
          resultado: "rechazado" as const,
          motivoRechazo: protecapResult.message,
          detalles: {
            protecap: protecapResult,
            bcra: { success: false, message: "No evaluado" },
            banco: { success: false, message: "No evaluado" },
          },
        }
        console.log(`❌ ValidationService: EVALUACIÓN RECHAZADA en Protecap - Tiempo total: ${Date.now() - startTime}ms`)
        return result
      }

      // Validación 2: BCRA
      console.log(`\n🏦 === PASO 2: VALIDACIÓN BCRA ===`)
      const bcraResult = await this.validateBCRA(clienteData.dni)

      if (!bcraResult.success) {
        if (bcraResult.details?.requiresManualReview) {
          const result = {
            resultado: "pendiente" as const,
            motivoRechazo: bcraResult.message,
            detalles: {
              protecap: protecapResult,
              bcra: bcraResult,
              banco: { success: false, message: "No evaluado" },
            },
          }
          console.log(`⏳ ValidationService: EVALUACIÓN PENDIENTE por BCRA - Tiempo total: ${Date.now() - startTime}ms`)
          return result
        } else {
          const result = {
            resultado: "rechazado" as const,
            motivoRechazo: bcraResult.message,
            detalles: {
              protecap: protecapResult,
              bcra: bcraResult,
              banco: { success: false, message: "No evaluado" },
            },
          }
          console.log(`❌ ValidationService: EVALUACIÓN RECHAZADA por BCRA - Tiempo total: ${Date.now() - startTime}ms`)
          return result
        }
      }

      // Validación 3: Banco
      console.log(`\n🏪 === PASO 3: VALIDACIÓN BANCO ===`)
      const bancoResult = await this.validateBanco(clienteData)

      if (!bancoResult.success) {
        const result = {
          resultado: "rechazado" as const,
          motivoRechazo: bancoResult.message,
          detalles: {
            protecap: protecapResult,
            bcra: bcraResult,
            banco: bancoResult,
          },
        }
        console.log(`❌ ValidationService: EVALUACIÓN RECHAZADA por Banco - Tiempo total: ${Date.now() - startTime}ms`)
        return result
      }

      // Calcular monto máximo
      console.log(`\n💰 === PASO 4: CÁLCULO DE MONTO ===`)
      const montoMaximo = this.calculateMaxAmount(clienteData, { bcra: bcraResult, banco: bancoResult })

      if (montoMaximo === 0) {
        const result = {
          resultado: "rechazado" as const,
          motivoRechazo: "No califica para monto mínimo de préstamo",
          detalles: {
            protecap: protecapResult,
            bcra: bcraResult,
            banco: bancoResult,
            montoCalculado: 0,
          },
        }
        console.log(`❌ ValidationService: EVALUACIÓN RECHAZADA por monto $0 - Tiempo total: ${Date.now() - startTime}ms`)
        return result
      }

      const result = {
        resultado: "aprobado" as const,
        montoMaximo,
        detalles: {
          protecap: protecapResult,
          bcra: bcraResult,
          banco: bancoResult,
          montoCalculado: montoMaximo,
        },
      }

      console.log(`\n🎉 === EVALUACIÓN APROBADA ===`)
      console.log(`✅ Monto máximo aprobado: $${montoMaximo}`)
      console.log(`⏱️ Tiempo total de evaluación: ${Date.now() - startTime}ms`)
      
      return result

    } catch (error) {
      console.error(`💥 ValidationService: Error inesperado en evaluación:`, error)
      return {
        resultado: "pendiente",
        motivoRechazo: "Error técnico en evaluación - Pendiente revisión manual",
        detalles: {
          protecap: { success: false, message: "Error técnico" },
          bcra: { success: false, message: "Error técnico" },
          banco: { success: false, message: "Error técnico" },
        },
      }
    }
  }
}
