// Servicio para manejo de datos locales y historial
export interface EvaluationRecord {
  id: string
  fecha: string
  cliente: {
    nombre: string
    apellido: string
    dni: string
    sueldoNeto: number
    tipoEmpleado: string
    provincia: string
    bancoPagador: string
  }
  resultado: "aprobado" | "rechazado" | "pendiente"
  montoMaximo?: number
  motivoRechazo?: string
  comercializador: {
    id: number
    nombre: string
    email: string
  }
  detalles?: {
    protecap: any
    bcra: any
    banco: any
  }
}

export interface DashboardStats {
  totalEvaluaciones: number
  aprobadas: number
  rechazadas: number
  pendientes: number
  montoPromedio: number
  montoTotal: number
  tasaAprobacion: number
  evaluacionesHoy: number
  evaluacionesSemana: number
}

export class StorageService {
  private static readonly STORAGE_KEY = "seap_evaluations"
  private static readonly USER_KEY = "seap_current_user"

  // Guardar evaluación en localStorage
  static saveEvaluation(evaluation: Omit<EvaluationRecord, "id" | "fecha">): EvaluationRecord {
    const record: EvaluationRecord = {
      ...evaluation,
      id: this.generateId(),
      fecha: new Date().toISOString(),
    }

    const existing = this.getEvaluations()
    existing.unshift(record) // Agregar al inicio

    // Mantener solo los últimos 100 registros
    const limited = existing.slice(0, 100)

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limited))
    return record
  }

  // Obtener todas las evaluaciones
  static getEvaluations(): EvaluationRecord[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error("Error loading evaluations:", error)
      return []
    }
  }

  // Obtener evaluaciones filtradas
  static getFilteredEvaluations(filters: {
    resultado?: string
    comercializador?: number
    fechaDesde?: string
    fechaHasta?: string
    busqueda?: string
  }): EvaluationRecord[] {
    let evaluations = this.getEvaluations()

    if (filters.resultado && filters.resultado !== "todos") {
      evaluations = evaluations.filter((e) => e.resultado === filters.resultado)
    }

    if (filters.comercializador) {
      evaluations = evaluations.filter((e) => e.comercializador.id === filters.comercializador)
    }

    if (filters.fechaDesde) {
      evaluations = evaluations.filter((e) => e.fecha >= filters.fechaDesde!)
    }

    if (filters.fechaHasta) {
      evaluations = evaluations.filter((e) => e.fecha <= filters.fechaHasta!)
    }

    if (filters.busqueda) {
      const search = filters.busqueda.toLowerCase()
      evaluations = evaluations.filter(
        (e) =>
          e.cliente.nombre.toLowerCase().includes(search) ||
          e.cliente.apellido.toLowerCase().includes(search) ||
          e.cliente.dni.includes(search),
      )
    }

    return evaluations
  }

  // Calcular estadísticas del dashboard
  static getDashboardStats(comercializadorId?: number): DashboardStats {
    const evaluations = comercializadorId
      ? this.getEvaluations().filter((e) => e.comercializador.id === comercializadorId)
      : this.getEvaluations()

    const total = evaluations.length
    const aprobadas = evaluations.filter((e) => e.resultado === "aprobado").length
    const rechazadas = evaluations.filter((e) => e.resultado === "rechazado").length
    const pendientes = evaluations.filter((e) => e.resultado === "pendiente").length

    const montosAprobados = evaluations
      .filter((e) => e.resultado === "aprobado" && e.montoMaximo)
      .map((e) => e.montoMaximo!)

    const montoTotal = montosAprobados.reduce((sum, monto) => sum + monto, 0)
    const montoPromedio = montosAprobados.length > 0 ? montoTotal / montosAprobados.length : 0

    const tasaAprobacion = total > 0 ? (aprobadas / total) * 100 : 0

    // Evaluaciones de hoy
    const hoy = new Date().toISOString().split("T")[0]
    const evaluacionesHoy = evaluations.filter((e) => e.fecha.startsWith(hoy)).length

    // Evaluaciones de esta semana
    const semanaAtras = new Date()
    semanaAtras.setDate(semanaAtras.getDate() - 7)
    const evaluacionesSemana = evaluations.filter((e) => new Date(e.fecha) >= semanaAtras).length

    return {
      totalEvaluaciones: total,
      aprobadas,
      rechazadas,
      pendientes,
      montoPromedio,
      montoTotal,
      tasaAprobacion,
      evaluacionesHoy,
      evaluacionesSemana,
    }
  }

  // Obtener evaluaciones recientes
  static getRecentEvaluations(limit = 5): EvaluationRecord[] {
    return this.getEvaluations().slice(0, limit)
  }

  // Limpiar historial
  static clearHistory(): void {
    localStorage.removeItem(this.STORAGE_KEY)
  }

  // Exportar datos
  static exportData(): string {
    const data = {
      evaluations: this.getEvaluations(),
      exportDate: new Date().toISOString(),
      version: "1.0",
    }
    return JSON.stringify(data, null, 2)
  }

  // Generar ID único
  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
}
