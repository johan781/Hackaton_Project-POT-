import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export const proyectos = {
  list: () => api.get('/projects/'),
  get: (id) => api.get(`/projects/${id}/`),
  resumen: (id) => api.get(`/projects/${id}/resumen/`),
  analysis: (id) => api.get(`/projects/${id}/analysis/`),
  create: (data) => api.post('/projects/', data),
}

export const hincados = {
  list: (proyectoId) => api.get('/hincados/', { params: { proyecto: proyectoId } }),
  get: (id) => api.get(`/hincados/${id}/`),
  clasificacion: (id) => api.get(`/hincados/${id}/clasificacion/`),
  create: (data) => api.post('/hincados/', data),
}

export const ensayos = {
  list: (hincadoId) => api.get('/ensayos/', { params: { hincado: hincadoId } }),
  get: (id) => api.get(`/ensayos/${id}/`),
  evaluar: (id) => api.post(`/ensayos/${id}/evaluar/`),
  create: (data) => api.post('/ensayos/', data),
}

export const ciclos = {
  list: (ensayoId) => api.get('/ciclos/', { params: { ensayo: ensayoId } }),
  create: (data) => api.post('/ciclos/', data),
}

export const puntos = {
  list: (cicloId) => api.get('/puntos/', { params: { ciclo: cicloId } }),
  createBulk: (data) => api.post('/puntos/', data),
}

export const analyzer = {
  analyze: (file, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    return axios.post('/api/analyze/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    })
  },
  save: (data) => api.post('/analyze/save/', data),
}

export default api
