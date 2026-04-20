'use strict';

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app     = express();
const port    = process.env.PORT || 3000;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

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

    const { data, error } = await supabase
        .from('reservas')
        .insert([{ nombre, apellido, email, servicio, precio, fecha, hora }])
        .select()
        .single();

    if (error) { console.error('Supabase POST error:', error); return res.status(500).json({ error: error.message }); }

    res.status(201).json({ ok: true, reserva: data });
});

app.listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
