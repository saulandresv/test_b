'use strict';

/* ============================================================
   STATE
   ============================================================ */
const state = {
    service:  null,
    price:    null,
    duration: null,
    date:     null,
    time:     null,
    month:    new Date().getMonth(),
    year:     new Date().getFullYear()
};

const API_URL = 'https://testb-production-30a4.up.railway.app';
const ALL_SLOTS = [
    '09:00','09:30','10:00','10:30','11:00','11:30',
    '12:00','12:30','13:00','13:30','14:00','14:30',
    '15:00','15:30','16:00','16:30','17:00','17:30',
    '18:00','18:30','19:00'
];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

/* ============================================================
   UTILIDADES
   ============================================================ */
function $(id) { return document.getElementById(id); }

function showError(id, msg) {
    const el = $(id);
    if (!el) return;
    el.textContent = msg;
    const input = el.previousElementSibling;
    if (input) input.classList.toggle('error', !!msg);
}

function clearErrors(...ids) {
    ids.forEach(id => showError(id, ''));
}

function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
}

/* ============================================================
   NAVEGACIÓN DE PASOS
   ============================================================ */
function nextStep(n) {
    document.querySelectorAll('.booking-panel').forEach(p => p.classList.remove('active'));
    $(`panel-${n}`).classList.add('active');
    document.querySelectorAll('.step').forEach((s, i) => {
        s.classList.remove('active', 'done');
        if (i + 1 < n) s.classList.add('done');
        if (i + 1 === n) s.classList.add('active');
    });
    if (n === 2) renderCalendar();
    $('booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ============================================================
   SERVICIOS
   ============================================================ */
function selectService(card) {
    document.querySelectorAll('.bscard').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.service  = card.dataset.service;
    state.price    = Number(card.dataset.price);
    state.duration = Number(card.dataset.dur);
    const btn = $('btn-next-1');
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
}

/* ============================================================
   CALENDARIO — usa createElement, sin innerHTML con datos
   ============================================================ */
function renderCalendar() {
    setText('cal-title', `${MONTHS[state.month]} ${state.year}`);
    const grid      = $('date-grid');
    const firstDay  = new Date(state.year, state.month, 1).getDay();
    const lastDay   = new Date(state.year, state.month + 1, 0).getDate();
    const today     = new Date(); today.setHours(0, 0, 0, 0);

    grid.innerHTML = '';

    DAYS.forEach(d => {
        const cell = document.createElement('div');
        cell.className = 'date-cell';
        const name = document.createElement('div');
        name.className = 'date-day-name';
        name.textContent = d;
        cell.appendChild(name);
        grid.appendChild(cell);
    });

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'date-cell empty';
        grid.appendChild(empty);
    }

    for (let d = 1; d <= lastDay; d++) {
        const dt       = new Date(state.year, state.month, d);
        const ds       = `${state.year}-${String(state.month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const disabled = dt < today || dt.getDay() === 0;
        const isToday  = dt.getTime() === today.getTime();

        const cell = document.createElement('div');
        cell.className = [
            'date-cell',
            disabled         ? 'disabled'  : '',
            state.date === ds ? 'selected' : '',
            isToday          ? 'today'     : ''
        ].filter(Boolean).join(' ');

        const label = dt.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
        cell.setAttribute('aria-label', disabled ? `${label}, no disponible` : label);
        if (!disabled) { cell.setAttribute('role', 'gridcell'); cell.setAttribute('tabindex', '0'); }

        const num = document.createElement('div');
        num.className = 'date-num';
        num.textContent = d;
        cell.appendChild(num);

        if (!disabled) {
            cell.addEventListener('click', () => selectDate(ds, cell));
            cell.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectDate(ds, cell); }
            });
        }

        grid.appendChild(cell);
    }
}

async function selectDate(ds, selectedCell) {
    document.querySelectorAll('#date-grid .date-cell').forEach(c => c.classList.remove('selected'));
    selectedCell.classList.add('selected');
    state.date = ds;
    state.time = null;

    const btn = $('btn-next-2');
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');

    $('time-section').style.display = 'block';
    await renderTimeSlots(ds);
}

/* ============================================================
   TIME SLOTS — consulta disponibilidad real desde la API
   ============================================================ */
async function renderTimeSlots(ds) {
    const container = $('time-slots');
    container.innerHTML = '<p class="slots-loading">Cargando horarios…</p>';

    let booked = [];
    try {
        const res  = await fetch(`${API_URL}/disponibilidad?fecha=${ds}`);
        const data = await res.json();
        booked = data.ocupados || [];
    } catch {
        container.innerHTML = '<p class="slots-error">Error al cargar horarios. Intenta de nuevo.</p>';
        return;
    }

    container.innerHTML = '';
    ALL_SLOTS.forEach(t => {
        const slot = document.createElement('div');
        slot.className = [
            'time-slot',
            booked.includes(t) ? 'booked'  : '',
            state.time === t   ? 'selected' : ''
        ].filter(Boolean).join(' ');
        slot.textContent = t;

        if (!booked.includes(t)) {
            slot.setAttribute('tabindex', '0');
            slot.addEventListener('click', () => selectTime(t, slot));
            slot.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTime(t, slot); }
            });
        }
        container.appendChild(slot);
    });
}

function selectTime(t, selectedSlot) {
    document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
    selectedSlot.classList.add('selected');
    state.time = t;
    const btn = $('btn-next-2');
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
}

function changeMonth(dir) {
    const now = new Date();
    const newMonth = state.month + dir;
    const newYear  = state.year + (newMonth > 11 ? 1 : newMonth < 0 ? -1 : 0);
    const clampedMonth = ((newMonth % 12) + 12) % 12;
    if (newYear < now.getFullYear() || (newYear === now.getFullYear() && clampedMonth < now.getMonth())) return;
    state.month = clampedMonth;
    state.year  = newYear;
    renderCalendar();
}

/* ============================================================
   PASO 3 — validación inline (sin alert)
   ============================================================ */
function goToPayment() {
    clearErrors('err-name', 'err-lastname', 'err-email');

    const name  = $('inp-name').value.trim();
    const last  = $('inp-lastname').value.trim();
    const email = $('inp-email').value.trim();
    let valid   = true;

    if (!name) { showError('err-name', 'Ingresa tu nombre'); valid = false; }
    if (!last) { showError('err-lastname', 'Ingresa tu apellido'); valid = false; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('err-email', 'Email no válido'); valid = false;
    }
    if (!valid) return;

    const [y, m, d] = state.date.split('-');
    const dt  = new Date(+y, +m - 1, +d);
    const dts = dt.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

    setText('sum-service',  state.service);
    setText('sum-price',    `$${state.price.toLocaleString('es-CL')}`);
    setText('sum-datetime', `${dts} · ${state.time} hrs`);
    setText('sum-total',    `$${state.price.toLocaleString('es-CL')}`);

    $('card-name').value = `${name} ${last}`.toUpperCase();
    updateCardName($('card-name'));
    nextStep(4);
}

/* ============================================================
   TARJETA — interacciones
   ============================================================ */
function formatCardNumber(inp) {
    let v  = inp.value.replace(/\D/g, '').substring(0, 16);
    inp.value = v.replace(/(.{4})/g, '$1 ').trim();
    const disp = v.padEnd(16, '•').replace(/(.{4})/g, '$1 ').trim();
    setText('card-num-disp', disp);
    const brand = $('card-brand-disp');
    if (brand) brand.textContent = v[0] === '4' ? 'Visa' : v[0] === '5' ? 'Mastercard' : v[0] === '3' ? 'Amex' : '';
}

function updateCardName(inp) {
    setText('card-name-disp', (inp.value.toUpperCase() || 'NOMBRE APELLIDO').substring(0, 22));
}

function formatExpiry(inp) {
    let v = inp.value.replace(/\D/g, '').substring(0, 4);
    if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2);
    inp.value = v;
    setText('card-exp-disp', v || 'MM/AA');
}

function updateCVV(inp) {
    inp.value = inp.value.replace(/\D/g, '').substring(0, 4);
    setText('card-cvv-disp', inp.value || '•••');
}

function flipCard(toBack) {
    $('card-visual').classList.toggle('flipped', toBack);
}

/* ============================================================
   CONFIRMACIÓN DE PAGO — validación inline
   ============================================================ */
async function confirmPayment() {
    clearErrors('err-card-number', 'err-card-name', 'err-card-exp', 'err-card-cvv');

    const num  = $('card-number').value.replace(/\s/g, '');
    const name = $('card-name').value.trim();
    const exp  = $('card-exp').value;
    const cvv  = $('card-cvv').value;
    let valid  = true;

    if (num.length < 16)              { showError('err-card-number', 'Número de tarjeta incompleto'); valid = false; }
    if (!name)                         { showError('err-card-name',   'Ingresa el nombre'); valid = false; }
    if (!/^\d{2}\/\d{2}$/.test(exp))  { showError('err-card-exp',    'Formato MM/AA'); valid = false; }
    if (cvv.length < 3)               { showError('err-card-cvv',    'CVV inválido'); valid = false; }
    if (!valid) return;

    const btn = $('btn-confirm');
    btn.disabled = true;
    btn.textContent = 'Procesando…';

    try {
        const res = await fetch(`${API_URL}/reservas`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre:   $('inp-name').value.trim(),
                apellido: $('inp-lastname').value.trim(),
                email:    $('inp-email').value.trim(),
                servicio: state.service,
                precio:   state.price,
                fecha:    state.date,
                hora:     state.time
            })
        });
        if (!res.ok) throw new Error();
    } catch {
        showError('err-card-number', 'Error al procesar la reserva. Intenta de nuevo.');
        btn.disabled = false;
        btn.textContent = 'Confirmar y Pagar';
        return;
    }

    const [y, m, d] = state.date.split('-');
    const dt  = new Date(+y, +m - 1, +d);
    const dts = dt.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

    setText('conf-service',  state.service);
    setText('conf-datetime', `${dts} · ${state.time} hrs`);
    setText('conf-total',    `$${state.price.toLocaleString('es-CL')}`);
    nextStep(5);
    requestAnimationFrame(() => {
        const conf = document.querySelector('.confirmation');
        if (conf) { conf.classList.remove('animate'); void conf.offsetWidth; conf.classList.add('animate'); }
    });
}

function resetBooking() {
    const now = new Date();
    Object.assign(state, {
        service: null, price: null, duration: null,
        date: null, time: null,
        month: now.getMonth(), year: now.getFullYear()
    });
    document.querySelectorAll('.bscard').forEach(c => c.classList.remove('selected'));
    $('btn-next-1').disabled = true;
    $('btn-next-1').setAttribute('aria-disabled', 'true');
    nextStep(1);
}

/* ============================================================
   SCROLL — indicador + nav glass
   ============================================================ */
const _nav = document.querySelector('nav');
const _ind = document.querySelector('.scroll-indicator');

/* Liberar el elemento del fill de la animación inicial para que
   la transition pueda tomar el control después que aparece */
if (_ind) {
    _ind.addEventListener('animationend', () => {
        _ind.style.opacity    = '1';
        _ind.style.transform  = 'translateY(0)';
        _ind.style.animation  = 'none';
    }, { once: true });
}

window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (_ind) _ind.classList.toggle('hidden', y > 60);
    if (_nav) _nav.classList.toggle('nav-scrolled', y > 40);
}, { passive: true });

/* ============================================================
   INIT — todo el binding de eventos aquí, cero inline handlers
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

    /* Servicio cards */
    document.querySelectorAll('.bscard').forEach(card => {
        card.addEventListener('click', () => selectService(card));
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectService(card); }
        });
    });

    /* Paso 1 */
    $('btn-next-1').addEventListener('click', () => nextStep(2));

    /* Calendario */
    $('cal-prev').addEventListener('click', () => changeMonth(-1));
    $('cal-next').addEventListener('click', () => changeMonth(1));
    $('btn-prev-2').addEventListener('click', () => nextStep(1));
    $('btn-next-2').addEventListener('click', () => nextStep(3));

    /* Paso 3 */
    $('btn-prev-3').addEventListener('click', () => nextStep(2));
    $('btn-next-3').addEventListener('click', () => goToPayment());

    /* Tarjeta */
    const cardNumber = $('card-number');
    const cardName   = $('card-name');
    const cardExp    = $('card-exp');
    const cardCvv    = $('card-cvv');

    cardNumber.addEventListener('input',  () => formatCardNumber(cardNumber));
    cardNumber.addEventListener('focus',  () => flipCard(false));

    cardName.addEventListener('input',  () => updateCardName(cardName));
    cardName.addEventListener('focus',  () => flipCard(false));

    cardExp.addEventListener('input',  () => formatExpiry(cardExp));
    cardExp.addEventListener('focus',  () => flipCard(false));

    cardCvv.addEventListener('input',  () => updateCVV(cardCvv));
    cardCvv.addEventListener('focus',  () => flipCard(true));
    cardCvv.addEventListener('blur',   () => flipCard(false));

    /* Paso 4 */
    $('btn-prev-4').addEventListener('click', () => {
        const btn = $('btn-confirm');
        btn.disabled = false;
        btn.textContent = 'Confirmar y Pagar';
        nextStep(3);
    });
    $('btn-confirm').addEventListener('click',  () => confirmPayment());

    /* Confirmación */
    $('btn-new-booking').addEventListener('click', () => resetBooking());

    /* Scroll reveal — IntersectionObserver */
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                revealObserver.unobserve(e.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
});
