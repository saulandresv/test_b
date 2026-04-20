'use strict';

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Resend }      = require('resend');

const app      = express();
const port     = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${port}`;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const resend   = new Resend(process.env.RESEND_API_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

/* ============================================================
   GET /disponibilidad?fecha=2026-04-22
   ============================================================ */
app.get('/disponibilidad', async (req, res) => {
    const { fecha } = req.query;
    if (!fecha) return res.status(400).json({ error: 'Falta el parámetro fecha' });

    const { data, error } = await supabase
        .from('reservas')
        .select('hora')
        .eq('fecha', fecha);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ ocupados: data.map(r => r.hora) });
});

/* ============================================================
   POST /reservas
   ============================================================ */
app.post('/reservas', async (req, res) => {
    const { nombre, apellido, email, servicio, precio, fecha, hora } = req.body;

    if (!nombre || !apellido || !servicio || !precio || !fecha || !hora) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const { data: existing } = await supabase
        .from('reservas')
        .select('id')
        .eq('fecha', fecha)
        .eq('hora', hora)
        .single();

    if (existing) return res.status(409).json({ error: 'Este horario ya fue reservado. Elige otro.' });

    const { data, error } = await supabase
        .from('reservas')
        .insert([{ nombre, apellido, email, servicio, precio, fecha, hora }])
        .select()
        .single();

    if (error) { console.error('Supabase POST error:', error); return res.status(500).json({ error: error.message }); }

    if (email) {
        const fechaStr = new Date(data.fecha + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const cancelUrl = `${BASE_URL}/cancelar?token=${data.cancel_token}`;

        const { error: emailError } = await resend.emails.send({
            from:    'Barber & Co <onboarding@resend.dev>',
            to:      email,
            subject: 'Reserva confirmada — Barber & Co',
            html:    `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111;color:#FAF7F2;padding:2rem;border:1px solid rgba(200,169,110,0.2)">
                    <h2 style="font-family:Georgia,serif;color:#C8A96E;margin-bottom:0.5rem">Barber &amp; Co.</h2>
                    <p style="font-size:0.85rem;color:#C8C2BA;margin-bottom:2rem;letter-spacing:0.05em">Providencia, Santiago</p>
                    <h3 style="color:#FAF7F2;font-weight:400">¡Reserva confirmada, ${nombre}!</h3>
                    <table style="width:100%;border-top:1px solid rgba(200,169,110,0.2);margin-top:1rem;padding-top:1rem">
                        <tr><td style="padding:0.4rem 0;color:#C8C2BA;font-size:0.82rem">Servicio</td><td style="color:#C8A96E;font-size:0.82rem">${servicio}</td></tr>
                        <tr><td style="padding:0.4rem 0;color:#C8C2BA;font-size:0.82rem">Fecha</td><td style="color:#FAF7F2;font-size:0.82rem">${fechaStr}</td></tr>
                        <tr><td style="padding:0.4rem 0;color:#C8C2BA;font-size:0.82rem">Hora</td><td style="color:#FAF7F2;font-size:0.82rem">${hora} hrs</td></tr>
                        <tr><td style="padding:0.4rem 0;color:#C8C2BA;font-size:0.82rem">Total</td><td style="color:#C8A96E;font-size:0.82rem">$${Number(precio).toLocaleString('es-CL')}</td></tr>
                    </table>
                    <p style="margin-top:2rem;font-size:0.78rem;color:#C8C2BA">¿Necesitas cancelar? Puedes hacerlo hasta 2 horas antes de tu cita.</p>
                    <a href="${cancelUrl}" style="display:inline-block;margin-top:1rem;padding:0.7rem 1.8rem;background:transparent;border:1px solid rgba(200,169,110,0.4);color:#C8A96E;text-decoration:none;font-size:0.72rem;letter-spacing:0.15em;text-transform:uppercase">Cancelar reserva</a>
                    <p style="margin-top:2rem;font-size:0.72rem;color:#C8C2BA">Av. Providencia 1234, Santiago · +56 2 2345 6789</p>
                </div>
            `
        });
        if (emailError) console.error('Resend error:', emailError);
    }

    res.status(201).json({ ok: true, reserva: data });
});

/* ============================================================
   GET /cancelar?token=xxxx
   ============================================================ */
app.get('/cancelar', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send(paginaCancelacion('error', 'Token inválido.'));

    const { data, error } = await supabase
        .from('reservas')
        .select('*')
        .eq('cancel_token', token)
        .single();

    if (error || !data) return res.send(paginaCancelacion('error', 'Reserva no encontrada o ya fue cancelada.'));

    const fechaCita = new Date(data.fecha + 'T' + data.hora + ':00');
    const ahora     = new Date();
    const diffHoras = (fechaCita - ahora) / (1000 * 60 * 60);

    if (diffHoras < 2) return res.send(paginaCancelacion('error', 'Solo puedes cancelar hasta 2 horas antes de tu cita.'));

    const { error: delError } = await supabase
        .from('reservas')
        .delete()
        .eq('cancel_token', token);

    if (delError) return res.send(paginaCancelacion('error', 'Error al cancelar. Intenta de nuevo.'));

    res.send(paginaCancelacion('ok', `Reserva cancelada. El horario de las ${data.hora} hrs del ${data.fecha} ha sido liberado.`));
});

function paginaCancelacion(tipo, mensaje) {
    const color = tipo === 'ok' ? '#C8A96E' : '#e74c3c';
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Barber &amp; Co</title>
    <style>body{margin:0;background:#080808;color:#FAF7F2;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    .box{text-align:center;max-width:400px;padding:2rem;border:1px solid rgba(200,169,110,0.2);}
    h2{font-family:Georgia,serif;color:#C8A96E;}p{color:#C8C2BA;font-size:0.85rem;line-height:1.8;}
    a{color:#C8A96E;font-size:0.72rem;letter-spacing:0.15em;text-transform:uppercase;}</style></head>
    <body><div class="box"><h2>Barber &amp; Co.</h2>
    <p style="color:${color}">${mensaje}</p>
    <br><a href="https://test-b-alpha.vercel.app">Volver al inicio</a></div></body></html>`;
}

app.listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
