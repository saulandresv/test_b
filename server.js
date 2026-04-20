'use strict';

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Resend }      = require('resend');

const app     = express();
const port    = process.env.PORT || 3000;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const resend   = new Resend(process.env.RESEND_API_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

/* ============================================================
   GET /disponibilidad?fecha=2026-04-22
   Devuelve los horarios ya reservados para una fecha
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
   Guarda una reserva nueva
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
        console.log('Enviando email a:', email);
        const fecha = new Date(data.fecha + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const { data: emailData, error: emailError } = await resend.emails.send({
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
                        <tr><td style="padding:0.4rem 0;color:#C8C2BA;font-size:0.82rem">Fecha</td><td style="color:#FAF7F2;font-size:0.82rem">${fecha}</td></tr>
                        <tr><td style="padding:0.4rem 0;color:#C8C2BA;font-size:0.82rem">Hora</td><td style="color:#FAF7F2;font-size:0.82rem">${hora} hrs</td></tr>
                        <tr><td style="padding:0.4rem 0;color:#C8C2BA;font-size:0.82rem">Total</td><td style="color:#C8A96E;font-size:0.82rem">$${Number(precio).toLocaleString('es-CL')}</td></tr>
                    </table>
                    <p style="margin-top:2rem;font-size:0.75rem;color:#C8C2BA">Av. Providencia 1234, Santiago · +56 2 2345 6789</p>
                </div>
            `
        });
        if (emailError) console.error('Resend error:', emailError);
        else console.log('Email enviado:', emailData?.id);
    }

    res.status(201).json({ ok: true, reserva: data });
});

app.listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
