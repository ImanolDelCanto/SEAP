// Servicio para integración real con API BCRA
// Endpoint: https://api.bcra.gob.ar/centraldeudores/v1.0/Deudas/{cuit}

export interface BCRADeuda {
  entidad: string
  situacion: number // 1-5
  monto: number
  fechaActualizacion: string
  diasAtraso?: number
}

export interface BCRAResponse {
  cuit: string
  fechaConsulta: string
  deudas: BCRADeuda[]
  resumen: {
    situacion1: number // Normal
    situacion2: number // Con seguimiento especial
    situacion3: number // Con problemas
    situacion4: number // Con alto riesgo de irrecuperabilidad
    situacion5: number // Irrecuperable
    totalEntidades: number
    montoTotal: number
  }
  inhabilitado: boolean
  observaciones?: string[]
}

export interface BCRAError {
  codigo: string
  mensaje: string
  detalles?: string
}

export class BCRAService {
  private static readonly BASE_URL = "https://api.bcra.gob.ar/centraldeudores/v1.0"
  private static readonly TIMEOUT_MS = 10000 // 10 segundos
  private static readonly MAX_RETRIES = 3

  // Obtener token desde variables de entorno
  private static getAuthToken(): string | null {
    // En producción, esto vendría de variables de entorno
    // return process.env.BCRA_API_TOKEN || null

    // Para el MVP, simular que no hay token configurado
    return null
  }

  // Realizar consulta a BCRA con reintentos
  static async consultarDeudas(cuit: string): Promise<BCRAResponse> {
    const token = this.getAuthToken()

    if (!token) {
      throw new Error("TOKEN_NOT_CONFIGURED")
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await this.makeRequest(cuit, token)
        return this.processResponse(response, cuit)
      } catch (error) {
        lastError = error as Error

        if (attempt < this.MAX_RETRIES) {
          // Esperar antes del siguiente intento (backoff exponencial)
          const delay = Math.pow(2, attempt) * 1000
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error("MAX_RETRIES_EXCEEDED")
  }

  // Realizar request HTTP a la API BCRA
  private static async makeRequest(cuit: string, token: string): Promise<any> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS)

    try {
      const response = await fetch(`${this.BASE_URL}/Deudas/${cuit}`, {
        method: "GET",
        headers: {
          Authorization: `BEARER ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP_ERROR_${response.status}`)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("TIMEOUT")
        }
        throw error
      }

      throw new Error("UNKNOWN_ERROR")
    }
  }

  // Procesar respuesta de la API BCRA
  private static processResponse(apiResponse: any, cuit: string): BCRAResponse {
    // Procesar las deudas y calcular resumen
    const deudas: BCRADeuda[] = apiResponse.deudas || []

    const resumen = {
      situacion1: 0,
      situacion2: 0,
      situacion3: 0,
      situacion4: 0,
      situacion5: 0,
      totalEntidades: deudas.length,
      montoTotal: 0,
    }

    // Contar situaciones y calcular monto total
    deudas.forEach((deuda) => {
      switch (deuda.situacion) {
        case 1:
          resumen.situacion1++
          break
        case 2:
          resumen.situacion2++
          break
        case 3:
          resumen.situacion3++
          break
        case 4:
          resumen.situacion4++
          break
        case 5:
          resumen.situacion5++
          break
      }
      resumen.montoTotal += deuda.monto || 0
    })

    // Determinar si está inhabilitado (tiene situación 5)
    const inhabilitado = resumen.situacion5 > 0

    return {
      cuit,
      fechaConsulta: new Date().toISOString(),
      deudas,
      resumen,
      inhabilitado,
      observaciones: apiResponse.observaciones || [],
    }
  }

  // Validar formato CUIT/DNI
  static validateCuit(cuit: string): boolean {
    // Remover guiones y espacios
    const cleanCuit = cuit.replace(/[-\s]/g, "")

    // Debe tener 11 dígitos para CUIT o 7-8 para DNI
    if (!/^\d{7,11}$/.test(cleanCuit)) {
      return false
    }

    // Si es DNI (7-8 dígitos), convertir a CUIT
    if (cleanCuit.length <= 8) {
      return true // DNI válido
    }

    // Validar dígito verificador de CUIT (algoritmo oficial)
    return this.validateCuitChecksum(cleanCuit)
  }

  // Validar dígito verificador de CUIT
  private static validateCuitChecksum(cuit: string): boolean {
    const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    let sum = 0

    for (let i = 0; i < 10; i++) {
      sum += Number.parseInt(cuit[i]) * multipliers[i]
    }

    const remainder = sum % 11
    const checkDigit = remainder < 2 ? remainder : 11 - remainder

    return checkDigit === Number.parseInt(cuit[10])
  }

  // Convertir DNI a CUIT (persona física)
  static dniToCuit(dni: string): string {
    const cleanDni = dni.replace(/\D/g, "")

    if (cleanDni.length < 7 || cleanDni.length > 8) {
      throw new Error("DNI_INVALID_LENGTH")
    }

    // Formato CUIT persona física: 20-DNI-X (donde X es dígito verificador)
    const baseCuit = "20" + cleanDni.padStart(8, "0")

    // Calcular dígito verificador
    const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    let sum = 0

    for (let i = 0; i < 10; i++) {
      sum += Number.parseInt(baseCuit[i]) * multipliers[i]
    }

    const remainder = sum % 11
    const checkDigit = remainder < 2 ? remainder : 11 - remainder

    return baseCuit + checkDigit.toString()
  }

  // Simular respuesta BCRA para testing (cuando no hay token)
  static generateMockResponse(cuit: string): BCRAResponse {
    const random = Math.random()

    if (random < 0.7) {
      // 70% casos favorables
      return {
        cuit,
        fechaConsulta: new Date().toISOString(),
        deudas: [
          {
            entidad: "Banco Nación",
            situacion: 1,
            monto: 0,
            fechaActualizacion: new Date().toISOString(),
          },
          {
            entidad: "Banco Galicia",
            situacion: 2,
            monto: 15000,
            fechaActualizacion: new Date().toISOString(),
          },
        ],
        resumen: {
          situacion1: 1,
          situacion2: 1,
          situacion3: 0,
          situacion4: 0,
          situacion5: 0,
          totalEntidades: 2,
          montoTotal: 15000,
        },
        inhabilitado: false,
      }
    } else {
      // 30% casos problemáticos
      const totalEntidades = Math.floor(Math.random() * 4) + 2
      const problematicas = Math.floor(totalEntidades * 0.6)

      return {
        cuit,
        fechaConsulta: new Date().toISOString(),
        deudas: Array.from({ length: totalEntidades }, (_, i) => ({
          entidad: `Entidad ${i + 1}`,
          situacion: i < problematicas ? (Math.random() < 0.5 ? 3 : 4) : 1,
          monto: Math.floor(Math.random() * 100000),
          fechaActualizacion: new Date().toISOString(),
        })),
        resumen: {
          situacion1: totalEntidades - problematicas,
          situacion2: 0,
          situacion3: Math.floor(problematicas * 0.7),
          situacion4: Math.floor(problematicas * 0.3),
          situacion5: Math.random() < 0.1 ? 1 : 0,
          totalEntidades,
          montoTotal: Math.floor(Math.random() * 500000),
        },
        inhabilitado: Math.random() < 0.1,
      }
    }
  }
}
