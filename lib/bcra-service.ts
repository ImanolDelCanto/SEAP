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
  private static readonly TIMEOUT_MS = 15000 // 15 segundos
  private static readonly MAX_RETRIES = 3

  // Obtener token desde variables de entorno
  private static getAuthToken(): string | null {
    console.log("🔑 BCRAService: Verificando token de autenticación...")
    
    // En producción, usar variable de entorno
    const token = process.env.NEXT_PUBLIC_BCRA_TOKEN || process.env.BCRA_TOKEN
    
    if (!token) {
      console.warn("⚠️ BCRAService: Token BCRA no configurado. Usando modo simulación.")
      return null
    }
    
    console.log("✅ BCRAService: Token encontrado")
    return token
  }

  // Realizar consulta a BCRA con reintentos
  static async consultarDeudas(cuit: string): Promise<BCRAResponse> {
    console.log(`🔍 BCRAService: Iniciando consulta para CUIT ${cuit}`)
    
    const token = this.getAuthToken()

    if (!token) {
      console.log("🎭 BCRAService: Sin token, generando respuesta simulada...")
      const mockResponse = this.generateMockResponse(cuit)
      console.log("✅ BCRAService: Respuesta simulada generada:", mockResponse.resumen)
      return mockResponse
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      console.log(`🔄 BCRAService: Intento ${attempt}/${this.MAX_RETRIES}`)
      
      try {
        const response = await this.makeRequest(cuit, token)
        const processedResponse = this.processResponse(response, cuit)
        
        console.log("✅ BCRAService: Consulta exitosa:", {
          cuit: processedResponse.cuit,
          totalEntidades: processedResponse.resumen.totalEntidades,
          inhabilitado: processedResponse.inhabilitado
        })
        
        return processedResponse
      } catch (error) {
        lastError = error as Error
        console.error(`❌ BCRAService: Error en intento ${attempt}:`, lastError.message)

        if (attempt < this.MAX_RETRIES) {
          // Esperar antes del siguiente intento (backoff exponencial)
          const delay = Math.pow(2, attempt) * 1000
          console.log(`⏳ BCRAService: Esperando ${delay}ms antes del próximo intento...`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    console.error("💥 BCRAService: Máximo de reintentos alcanzado")
    throw lastError || new Error("MAX_RETRIES_EXCEEDED")
  }

  // Realizar request HTTP a la API BCRA
  private static async makeRequest(cuit: string, token: string): Promise<any> {
    console.log(`🌐 BCRAService: Realizando petición HTTP a ${this.BASE_URL}/Deudas/${cuit}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.warn("⏱️ BCRAService: Timeout alcanzado, cancelando petición...")
      controller.abort()
    }, this.TIMEOUT_MS)

    try {
      const startTime = Date.now()
      
      const response = await fetch(`${this.BASE_URL}/Deudas/${cuit}`, {
        method: "GET",
        headers: {
          Authorization: `BEARER ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "SEAP-System/1.0"
        },
        signal: controller.signal,
      })

      const endTime = Date.now()
      console.log(`⚡ BCRAService: Petición completada en ${endTime - startTime}ms`)

      clearTimeout(timeoutId)

      console.log(`📡 BCRAService: Respuesta HTTP ${response.status} - ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Sin detalles del error")
        console.error(`🚫 BCRAService: Error HTTP ${response.status}:`, errorText)
        throw new Error(`HTTP_ERROR_${response.status}`)
      }

      const responseData = await response.json()
      console.log("📄 BCRAService: Datos recibidos:", {
        hasDeudas: !!responseData.deudas,
        deudasCount: responseData.deudas?.length || 0
      })

      return responseData
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          console.error("⏱️ BCRAService: Petición cancelada por timeout")
          throw new Error("TIMEOUT")
        }
        console.error("🚨 BCRAService: Error en petición:", error.message)
        throw error
      }

      console.error("❓ BCRAService: Error desconocido en petición")
      throw new Error("UNKNOWN_ERROR")
    }
  }

  // Procesar respuesta de la API BCRA
  private static processResponse(apiResponse: any, cuit: string): BCRAResponse {
    console.log("🔧 BCRAService: Procesando respuesta de la API...")
    
    // Procesar las deudas y calcular resumen
    const deudas: BCRADeuda[] = apiResponse.deudas || []
    console.log(`📊 BCRAService: Procesando ${deudas.length} deudas`)

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
    deudas.forEach((deuda, index) => {
      console.log(`📋 BCRAService: Deuda ${index + 1} - ${deuda.entidad}: Situación ${deuda.situacion}, Monto: $${deuda.monto}`)
      
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
    
    console.log("📈 BCRAService: Resumen calculado:", {
      ...resumen,
      inhabilitado,
      porcentajeProblematicas: resumen.totalEntidades > 0 
        ? ((resumen.situacion3 + resumen.situacion4 + resumen.situacion5) / resumen.totalEntidades * 100).toFixed(1) + '%'
        : '0%'
    })

    const processedResponse = {
      cuit,
      fechaConsulta: new Date().toISOString(),
      deudas,
      resumen,
      inhabilitado,
      observaciones: apiResponse.observaciones || [],
    }

    console.log("✅ BCRAService: Respuesta procesada exitosamente")
    return processedResponse
  }

  // Validar formato CUIT/DNI
  static validateCuit(cuit: string): boolean {
    console.log(`🔍 BCRAService: Validando formato CUIT ${cuit}`)
    
    if (!cuit || cuit.length !== 11) {
      console.log("❌ BCRAService: CUIT debe tener 11 dígitos")
      return false
    }

    if (!/^\d{11}$/.test(cuit)) {
      console.log("❌ BCRAService: CUIT debe contener solo números")
      return false
    }

    const isValid = this.validateCuitChecksum(cuit)
    console.log(`${isValid ? '✅' : '❌'} BCRAService: Validación de dígito verificador: ${isValid ? 'VÁLIDO' : 'INVÁLIDO'}`)
    
    return isValid
  }

  // Validar dígito verificador de CUIT
  private static validateCuitChecksum(cuit: string): boolean {
    const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    let sum = 0

    for (let i = 0; i < 10; i++) {
      sum += parseInt(cuit[i]) * multipliers[i]
    }

    const remainder = sum % 11
    const checkDigit = remainder < 2 ? remainder : 11 - remainder

    return checkDigit === parseInt(cuit[10])
  }

  // Convertir DNI a CUIT (persona física)
  static dniToCuit(dni: string): string {
    console.log(`🔄 BCRAService: Convirtiendo DNI ${dni} a CUIT`)
    
    if (dni.length !== 8) {
      console.error("❌ BCRAService: DNI debe tener 8 dígitos")
      throw new Error("DNI inválido")
    }

    // Para personas físicas masculinas, usar prefijo 20
    const prefix = "20"
    const baseCuit = prefix + dni

    // Calcular dígito verificador
    const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    let sum = 0

    for (let i = 0; i < 10; i++) {
      sum += parseInt(baseCuit[i]) * multipliers[i]
    }

    const remainder = sum % 11
    const checkDigit = remainder < 2 ? remainder : 11 - remainder

    const cuit = baseCuit + checkDigit.toString()
    console.log(`✅ BCRAService: DNI convertido a CUIT: ${cuit}`)
    
    return cuit
  }

  // Simular respuesta BCRA para testing (cuando no hay token)
  static generateMockResponse(cuit: string): BCRAResponse {
    console.log(`🎭 BCRAService: Generando respuesta simulada para CUIT ${cuit}`)
    
    // Usar el CUIT como semilla para generar resultados consistentes
    const seed = parseInt(cuit.slice(-4))
    const random = (seed * 9301 + 49297) % 233280 / 233280

    if (random < 0.7) {
      // 70% casos favorables
      console.log("✅ BCRAService: Generando caso FAVORABLE (simulado)")
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
      console.log("⚠️ BCRAService: Generando caso PROBLEMÁTICO (simulado)")
      const totalEntidades = Math.floor(random * 4) + 2
      const problematicas = Math.floor(totalEntidades * 0.6)

      return {
        cuit,
        fechaConsulta: new Date().toISOString(),
        deudas: Array.from({ length: totalEntidades }, (_, i) => ({
          entidad: `Entidad ${i + 1}`,
          situacion: i < problematicas ? (random < 0.5 ? 3 : 4) : 1,
          monto: Math.floor(random * 100000),
          fechaActualizacion: new Date().toISOString(),
        })),
        resumen: {
          situacion1: totalEntidades - problematicas,
          situacion2: 0,
          situacion3: Math.floor(problematicas * 0.7),
          situacion4: Math.floor(problematicas * 0.3),
          situacion5: random < 0.1 ? 1 : 0,
          totalEntidades,
          montoTotal: Math.floor(random * 500000),
        },
        inhabilitado: random < 0.1,
      }
    }
  }
}
