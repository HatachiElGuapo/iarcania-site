;(function(){
  let _courses = []
  let _activeCourse = null
  let _activeTab = 'cursos' // cursos | estudiantes

  async function loadEscAdmin(){
    const el = document.getElementById('section-escuela')
    if(!el) return
    el.innerHTML = `<div class="loading"><div class="spinner"></div><br>Cargando escuela...</div>`
    const [{ data: courses }, { data: students }] = await Promise.all([
      SB_P.from('courses').select('*').order('orden'),
      SB_P.from('students').select('*').order('created_at', { ascending: false })
    ])
    _courses = courses || []
    window._escStudents = students || []
    renderEscAdmin()
  }

  function renderEscAdmin(){
    const el = document.getElementById('section-escuela')
    if(!el) return
    el.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">🎓 Escuela</h1>
          <div class="page-sub">Cursos, clases y estudiantes</div>
        </div>
        <div style="display:flex;gap:8px">
          ${_activeTab === 'cursos' ? `<button class="btn-add" onclick="window._escAdmin.newCourse()">+ Nuevo curso</button>` : ''}
        </div>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:20px">
        <button onclick="window._escAdmin.setTab('cursos')" style="${tabBtn(_activeTab==='cursos')}">📚 Cursos (${_courses.length})</button>
        <button onclick="window._escAdmin.setTab('estudiantes')" style="${tabBtn(_activeTab==='estudiantes')}">👥 Estudiantes (${(window._escStudents||[]).length})</button>
      </div>

      ${_activeTab === 'cursos' ? renderCursos() : renderEstudiantes()}
    `
  }

  function tabBtn(active){
    return active
      ? 'padding:7px 16px;font-size:12px;font-family:Outfit,sans-serif;font-weight:600;border:1px solid #444;border-radius:8px;background:#161616;color:var(--gold);cursor:pointer'
      : 'padding:7px 16px;font-size:12px;font-family:Outfit,sans-serif;border:1px solid #2a2a2a;border-radius:8px;background:transparent;color:#888;cursor:pointer'
  }

  function renderCursos(){
    if(!_courses.length) return `<div class="empty-state"><div class="empty-icon">🎓</div>Sin cursos todavía — crea el primero</div>`
    return _courses.map(c => {
      const isActive = c.id === _activeCourse
      const canalColor = c.canal === 'voidstoic' ? '#8B6CF6' : '#E24B4A'
      const canalLabel = c.canal === 'voidstoic' ? 'Void Stoic' : 'IArcanIA'
      return `
        <div class="script-card${isActive ? ' active' : ''}" style="border-left-color:${canalColor};margin-bottom:8px">
          <div onclick="window._escAdmin.toggleCourse('${c.id}')" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:600;color:var(--text)">${c.title}</div>
              <div style="font-size:11px;margin-top:3px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                <span style="color:${canalColor};font-weight:600">${canalLabel}</span>
                <span style="color:${c.active ? '#5DCAA5' : 'var(--text-muted)'}">${c.active ? '● Activo' : '○ Inactivo'}</span>
              </div>
            </div>
            <span style="color:var(--text-muted);font-size:18px;transition:transform .2s;${isActive ? 'transform:rotate(180deg)' : ''}">⌄</span>
          </div>
          ${isActive ? renderCourseDetail(c) : ''}
        </div>`
    }).join('')
  }

  function renderCourseDetail(c){
    const iStyle = 'width:100%;background:#161616;border:1px solid #2a2a2a;border-radius:6px;padding:9px 12px;color:#e8e8e8;font-family:Outfit,sans-serif;font-size:13px;outline:none;box-sizing:border-box'
    const tStyle = iStyle + ';resize:vertical'
    const lStyle = 'font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;display:block'
    const lessons = (window._escLessons || {})[c.id] || []
    const TIER_COLOR = { gratis:'#888', plus:'#EF9F27', pro:'#8B6CF6', founder:'#5DCAA5' }

    return `
      <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px;display:flex;flex-direction:column;gap:14px">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="grid-column:1/-1">
            <label style="${lStyle}">Título</label>
            <input id="ec-title-${c.id}" value="${c.title.replace(/"/g,'&quot;')}" style="${iStyle}">
          </div>
          <div style="grid-column:1/-1">
            <label style="${lStyle}">Descripción</label>
            <textarea id="ec-desc-${c.id}" style="${tStyle};min-height:70px">${c.description||''}</textarea>
          </div>
          <div>
            <label style="${lStyle}">Canal</label>
            <select id="ec-canal-${c.id}" style="${iStyle}">
              <option value="iarcania" ${c.canal==='iarcania'?'selected':''}>IArcanIA</option>
              <option value="voidstoic" ${c.canal==='voidstoic'?'selected':''}>Void Stoic</option>
            </select>
          </div>
          <div>
            <label style="${lStyle}">Estado</label>
            <select id="ec-active-${c.id}" style="${iStyle}">
              <option value="true" ${c.active?'selected':''}>Activo (visible)</option>
              <option value="false" ${!c.active?'selected':''}>Inactivo (oculto)</option>
            </select>
          </div>
          <div>
            <label style="${lStyle}">Thumbnail URL</label>
            <input id="ec-thumb-${c.id}" value="${(c.thumbnail_url||'').replace(/"/g,'&quot;')}" placeholder="https://..." style="${iStyle}">
          </div>
          <div>
            <label style="${lStyle}">Orden</label>
            <input id="ec-orden-${c.id}" type="number" value="${c.orden||0}" style="${iStyle}">
          </div>
        </div>

        <div style="display:flex;gap:8px">
          <button onclick="window._escAdmin.saveCourse('${c.id}')" class="btn-save">Guardar curso</button>
          <button onclick="window._escAdmin.deleteCourse('${c.id}')" style="padding:9px 14px;border-radius:8px;border:1px solid rgba(226,75,74,0.3);background:transparent;color:var(--red);cursor:pointer;font-family:Outfit,sans-serif;font-size:13px">Eliminar</button>
        </div>

        <div style="border-top:1px solid #1e1e1e;padding-top:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div style="font-size:12px;font-weight:600;color:#5a5870;text-transform:uppercase;letter-spacing:.5px">Clases (${lessons.length})</div>
            <button onclick="window._escAdmin.loadLessons('${c.id}', true)" style="padding:5px 12px;font-size:11px;background:transparent;border:1px solid #2a2a2a;border-radius:6px;color:#888;cursor:pointer;font-family:Outfit,sans-serif">+ Agregar clase</button>
          </div>
          ${lessons.length ? lessons.map((l,i) => `
            <div style="border:1px solid #1e1e1e;border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;flex-direction:column;gap:8px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:11px;color:#5a5870;font-family:Outfit,sans-serif;width:20px">${i+1}.</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;color:var(--text);font-family:Outfit,sans-serif">${l.title}</div>
                  <div style="font-size:10px;color:#5a5870;font-family:Outfit,sans-serif;margin-top:2px;display:flex;gap:8px">
                    <span style="color:${TIER_COLOR[l.tier_required]||'#888'}">${l.tier_required}</span>
                    ${l.duration_min ? `· ${l.duration_min} min` : ''}
                    ${l.video_url ? `· <a href="${l.video_url}" target="_blank" style="color:#a78bfa;text-decoration:none">ver video ↗</a>` : '· sin video'}
                  </div>
                </div>
                <button onclick="window._escAdmin.editLesson('${c.id}','${l.id}')" style="padding:4px 10px;font-size:11px;background:transparent;border:1px solid #2a2a2a;border-radius:5px;color:#888;cursor:pointer;font-family:Outfit,sans-serif">Editar</button>
                <button onclick="window._escAdmin.deleteLesson('${l.id}','${c.id}')" style="padding:4px 8px;font-size:11px;background:transparent;border:1px solid rgba(226,75,74,0.2);border-radius:5px;color:var(--red);cursor:pointer;font-family:Outfit,sans-serif">✕</button>
              </div>
              ${window._editLesson === l.id ? lessonForm(c.id, l) : ''}
            </div>`).join('')
          : `<div style="font-size:12px;color:#5a5870;font-family:Outfit,sans-serif;padding:8px 0">Sin clases todavía</div>`}
          ${window._newLesson === c.id ? lessonForm(c.id, null) : ''}
        </div>

      </div>`
  }

  function lessonForm(courseId, l){
    const iStyle = 'width:100%;background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:8px 11px;color:#e8e8e8;font-family:Outfit,sans-serif;font-size:12px;outline:none;box-sizing:border-box'
    const lStyle = 'font-size:10px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;display:block'
    const id = l ? l.id : 'new'
    return `
      <div style="border-top:1px dashed #2a2a2a;padding-top:8px;display:flex;flex-direction:column;gap:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div style="grid-column:1/-1">
            <label style="${lStyle}">Título de la clase</label>
            <input id="el-title-${id}" value="${l ? l.title.replace(/"/g,'&quot;') : ''}" placeholder="Ej: ¿Qué es un webhook?" style="${iStyle}">
          </div>
          <div style="grid-column:1/-1">
            <label style="${lStyle}">Link del video (Google Drive)</label>
            <input id="el-video-${id}" type="url" value="${l ? (l.video_url||'') : ''}" placeholder="https://drive.google.com/file/d/..." style="${iStyle}">
          </div>
          <div>
            <label style="${lStyle}">Tier requerido</label>
            <select id="el-tier-${id}" style="${iStyle}">
              <option value="gratis" ${(!l||l.tier_required==='gratis')?'selected':''}>Gratis</option>
              <option value="plus" ${l?.tier_required==='plus'?'selected':''}>Plus</option>
              <option value="pro" ${l?.tier_required==='pro'?'selected':''}>Pro</option>
            </select>
          </div>
          <div>
            <label style="${lStyle}">Duración (min)</label>
            <input id="el-dur-${id}" type="number" value="${l ? (l.duration_min||'') : ''}" placeholder="15" style="${iStyle}">
          </div>
          <div>
            <label style="${lStyle}">Orden</label>
            <input id="el-orden-${id}" type="number" value="${l ? (l.orden||0) : ((window._escLessons||{})[courseId]||[]).length}" style="${iStyle}">
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="window._escAdmin.saveLesson('${courseId}','${id}')" style="padding:7px 16px;border-radius:6px;background:#fff;color:#000;border:none;font-family:Outfit,sans-serif;font-size:12px;font-weight:600;cursor:pointer">${l ? 'Guardar' : 'Agregar clase'}</button>
          <button onclick="window._escAdmin.cancelLessonEdit()" style="padding:7px 12px;border-radius:6px;background:transparent;border:1px solid #2a2a2a;color:#888;font-family:Outfit,sans-serif;font-size:12px;cursor:pointer">Cancelar</button>
        </div>
      </div>`
  }

  function renderEstudiantes(){
    const students = window._escStudents || []
    const TIER_COLOR = { gratis:'#888', plus:'#EF9F27', pro:'#8B6CF6', founder:'#d4af37' }
    const TIER_LABEL = { gratis:'Gratis', plus:'Plus', pro:'Pro', founder:'👑 Fundador' }
    const counts = { gratis:0, plus:0, pro:0, founder:0 }
    students.forEach(s => { counts[s.tier] = (counts[s.tier]||0) + 1 })

    return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
        ${Object.entries(counts).map(([tier,n]) => `
          <div style="background:#0e0e0e;border:1px solid #1e1e1e;border-radius:10px;padding:14px 16px">
            <div style="font-size:22px;font-weight:700;color:${TIER_COLOR[tier]||'#888'};font-family:Outfit,sans-serif">${n}</div>
            <div style="font-size:11px;color:#5a5870;font-family:Outfit,sans-serif;margin-top:2px">${TIER_LABEL[tier]||tier}</div>
          </div>`).join('')}
      </div>
      ${!students.length
        ? `<div class="empty-state"><div class="empty-icon">👥</div>Sin estudiantes todavía</div>`
        : `<div style="display:flex;flex-direction:column;gap:6px">
          ${students.map(s => `
            <div style="background:#0e0e0e;border:1px solid #1e1e1e;border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text);font-family:Outfit,sans-serif">${s.name || s.email}</div>
                <div style="font-size:11px;color:#5a5870;font-family:Outfit,sans-serif;margin-top:2px">${s.email} · ${new Date(s.created_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="padding:3px 10px;font-size:11px;font-family:Outfit,sans-serif;color:${TIER_COLOR[s.tier]||'#888'};border:1px solid ${TIER_COLOR[s.tier]||'#888'}33;border-radius:20px">${TIER_LABEL[s.tier]||s.tier}</span>
                <select onchange="window._escAdmin.changeTier('${s.id}',this.value)" style="background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:4px 8px;color:#888;font-family:Outfit,sans-serif;font-size:11px;outline:none;cursor:pointer">
                  <option value="">Cambiar tier</option>
                  <option value="gratis">Gratis</option>
                  <option value="plus">Plus</option>
                  <option value="pro">Pro</option>
                  <option value="founder">Fundador</option>
                </select>
              </div>
            </div>`).join('')}
        </div>`}
    `
  }

  // ── Acciones ──────────────────────────────────────────

  async function newCourse(){
    const id = 'c_' + Date.now()
    const { error } = await SB_P.from('courses').insert({
      id, title: 'Nuevo curso', canal: 'iarcania', active: false, orden: _courses.length
    })
    if(error){ showToast('❌ ' + error.message); return }
    _activeCourse = id
    await loadEscAdmin()
  }

  async function saveCourse(id){
    const data = {
      title:         document.getElementById('ec-title-'+id)?.value.trim(),
      description:   document.getElementById('ec-desc-'+id)?.value.trim() || null,
      canal:         document.getElementById('ec-canal-'+id)?.value,
      active:        document.getElementById('ec-active-'+id)?.value === 'true',
      thumbnail_url: document.getElementById('ec-thumb-'+id)?.value.trim() || null,
      orden:         parseInt(document.getElementById('ec-orden-'+id)?.value) || 0
    }
    if(!data.title){ showToast('❌ El título es obligatorio'); return }
    const { error } = await SB_P.from('courses').update(data).eq('id', id)
    if(error){ showToast('❌ ' + error.message); return }
    showToast('✅ Curso guardado')
    await loadEscAdmin()
  }

  async function deleteCourse(id){
    if(!confirm('¿Eliminar este curso y todas sus clases?')) return
    await SB_P.from('lessons').delete().eq('course_id', id)
    await SB_P.from('courses').delete().eq('id', id)
    _activeCourse = null
    showToast('🗑 Curso eliminado')
    await loadEscAdmin()
  }

  async function loadLessons(courseId, openNew){
    const { data } = await SB_P.from('lessons').select('*').eq('course_id', courseId).order('orden')
    if(!window._escLessons) window._escLessons = {}
    window._escLessons[courseId] = data || []
    if(openNew) window._newLesson = courseId
    renderEscAdmin()
  }

  function editLesson(courseId, lessonId){
    window._editLesson = lessonId
    loadLessons(courseId, false)
  }

  function cancelLessonEdit(){
    window._editLesson = null
    window._newLesson  = null
    renderEscAdmin()
  }

  async function saveLesson(courseId, lessonId){
    const isNew = lessonId === 'new'
    const id    = isNew ? 'l_' + Date.now() : lessonId
    const data  = {
      id,
      course_id:     courseId,
      title:         document.getElementById('el-title-'+lessonId)?.value.trim(),
      video_url:     document.getElementById('el-video-'+lessonId)?.value.trim() || null,
      tier_required: document.getElementById('el-tier-'+lessonId)?.value || 'gratis',
      duration_min:  parseInt(document.getElementById('el-dur-'+lessonId)?.value) || null,
      orden:         parseInt(document.getElementById('el-orden-'+lessonId)?.value) || 0
    }
    if(!data.title){ showToast('❌ El título es obligatorio'); return }
    const { error } = isNew
      ? await SB_P.from('lessons').insert(data)
      : await SB_P.from('lessons').update(data).eq('id', id)
    if(error){ showToast('❌ ' + error.message); return }
    window._editLesson = null
    window._newLesson  = null
    showToast('✅ Clase guardada')
    await loadLessons(courseId, false)
  }

  async function deleteLesson(lessonId, courseId){
    if(!confirm('¿Eliminar esta clase?')) return
    await SB_P.from('lessons').delete().eq('id', lessonId)
    showToast('🗑 Clase eliminada')
    await loadLessons(courseId, false)
  }

  async function changeTier(studentId, tier){
    if(!tier) return
    const isFounder = tier === 'founder'
    const { error } = await SB_P.from('students').update({
      tier: isFounder ? 'pro' : tier,
      is_founder: isFounder
    }).eq('id', studentId)
    if(error){ showToast('❌ ' + error.message); return }
    showToast('✅ Tier actualizado')
    const { data } = await SB_P.from('students').select('*').order('created_at', { ascending: false })
    window._escStudents = data || []
    renderEscAdmin()
  }

  window._escAdmin = {
    loadEscAdmin, setTab(t){ _activeTab = t; renderEscAdmin() },
    toggleCourse(id){ _activeCourse = _activeCourse === id ? null : id; window._newLesson = null; window._editLesson = null; renderEscAdmin() },
    newCourse, saveCourse, deleteCourse,
    loadLessons, editLesson, cancelLessonEdit, saveLesson, deleteLesson,
    changeTier
  }

  window.loadEscAdmin = loadEscAdmin
})()
