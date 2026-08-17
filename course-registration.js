'use strict';

const MAX_CREDITS = 18;
const STORAGE_KEY = 'courseReg.registrations';
const PROFILES_KEY = 'courseReg.profiles';
const CURRENT_STUDENT_KEY = 'courseReg.currentStudent';

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SECTIONS = [
    { id: 'CS101-A', courseCode: 'CS101', courseTitle: 'Introduction to Programming', section: 'A', instructor: 'Dr. Ali Raza', days: ['Mon', 'Wed', 'Fri'], start: '09:00', end: '09:50', room: 'Room 204', capacity: 3, credits: 3 },
    { id: 'CS101-B', courseCode: 'CS101', courseTitle: 'Introduction to Programming', section: 'B', instructor: 'Dr. Sara Malik', days: ['Tue', 'Thu'], start: '11:00', end: '12:15', room: 'Room 210', capacity: 3, credits: 3 },
    { id: 'CS210-A', courseCode: 'CS210', courseTitle: 'Data Structures', section: 'A', instructor: 'Dr. Ahmed Bilal', days: ['Tue', 'Thu'], start: '09:30', end: '10:45', room: 'Room 208', capacity: 3, credits: 4 },
    { id: 'MATH201-A', courseCode: 'MATH201', courseTitle: 'Calculus II', section: 'A', instructor: 'Dr. Imran Khan', days: ['Mon', 'Wed', 'Fri'], start: '10:00', end: '10:50', room: 'Room 101', capacity: 2, credits: 3 },
    { id: 'ENG105-A', courseCode: 'ENG105', courseTitle: 'Academic Writing', section: 'A', instructor: 'Ms. Fatima Noor', days: ['Tue', 'Thu'], start: '13:00', end: '14:15', room: 'Room 305', capacity: 3, credits: 2 },
    { id: 'PHY150-A', courseCode: 'PHY150', courseTitle: 'Physics I', section: 'A', instructor: 'Dr. Tariq Javed', days: ['Mon', 'Wed', 'Fri'], start: '13:00', end: '13:50', room: 'Room 102', capacity: 2, credits: 3 },
];

function loadRegistrations() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function saveRegistrations(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadProfiles() {
    try {
        return JSON.parse(localStorage.getItem(PROFILES_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function saveProfile(studentId, name, email) {
    const profiles = loadProfiles();
    profiles[studentId] = { name, email };
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function getProfile(studentId) {
    return loadProfiles()[studentId] || { name: '', email: '' };
}

function getCurrentStudentId() {
    return localStorage.getItem(CURRENT_STUDENT_KEY) || '';
}

function setCurrentStudentId(id) {
    localStorage.setItem(CURRENT_STUDENT_KEY, id);
}

function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function sectionsConflict(a, b) {
    const sharedDay = a.days.some((d) => b.days.includes(d));
    if (!sharedDay) return false;
    return timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end);
}

function enrolledCount(sectionId) {
    const registrations = loadRegistrations();
    let count = 0;
    for (const studentId in registrations) {
        if (registrations[studentId].sections.includes(sectionId)) count++;
    }
    return count;
}

function getStudentRecord(studentId) {
    const registrations = loadRegistrations();
    return registrations[studentId] || { name: '', email: '', sections: [] };
}

function canRegister(studentId, section) {
    const record = getStudentRecord(studentId);
    if (record.sections.includes(section.id)) {
        return { ok: false, reason: 'Already registered for this section.' };
    }
    if (enrolledCount(section.id) >= section.capacity) {
        return { ok: false, reason: 'Section is full.' };
    }
    const sameCourse = record.sections
        .map((id) => SECTIONS.find((s) => s.id === id))
        .filter(Boolean)
        .find((s) => s.courseCode === section.courseCode);
    if (sameCourse) {
        return { ok: false, reason: `Already registered for ${section.courseCode} (Section ${sameCourse.section}).` };
    }
    const currentCredits = record.sections.reduce((sum, id) => {
        const s = SECTIONS.find((sec) => sec.id === id);
        return sum + (s ? s.credits : 0);
    }, 0);
    if (currentCredits + section.credits > MAX_CREDITS) {
        return { ok: false, reason: `Exceeds maximum of ${MAX_CREDITS} credits.` };
    }
    const conflict = record.sections
        .map((id) => SECTIONS.find((s) => s.id === id))
        .filter(Boolean)
        .find((s) => sectionsConflict(s, section));
    if (conflict) {
        return { ok: false, reason: `Time conflict with ${conflict.courseCode} (Section ${conflict.section}).` };
    }
    return { ok: true };
}

function registerSection(studentId, name, email, sectionId) {
    const section = SECTIONS.find((s) => s.id === sectionId);
    if (!section) return { ok: false, reason: 'Unknown section.' };
    const check = canRegister(studentId, section);
    if (!check.ok) return check;

    const registrations = loadRegistrations();
    if (!registrations[studentId]) {
        registrations[studentId] = { name, email, sections: [] };
    }
    registrations[studentId].name = name;
    registrations[studentId].email = email;
    registrations[studentId].sections.push(sectionId);
    saveRegistrations(registrations);
    return { ok: true };
}

function dropSection(studentId, sectionId) {
    const registrations = loadRegistrations();
    if (!registrations[studentId]) return;
    registrations[studentId].sections = registrations[studentId].sections.filter((id) => id !== sectionId);
    saveRegistrations(registrations);
}

function formatSchedule(section) {
    return `${section.days.join('/')} ${section.start}–${section.end}`;
}

function render() {
    const studentId = getCurrentStudentId();
    const record = studentId ? getStudentRecord(studentId) : null;

    document.getElementById('studentIdInput').value = studentId;
    if (studentId) {
        const profile = getProfile(studentId);
        document.getElementById('studentNameInput').value = profile.name;
        document.getElementById('studentEmailInput').value = profile.email;
    }

    renderSections(studentId);
    renderSchedule(studentId, record);
}

function renderSections(studentId) {
    const search = document.getElementById('searchInput').value.trim().toLowerCase();
    const dept = document.getElementById('deptFilter').value;
    const list = document.getElementById('sectionsList');
    list.innerHTML = '';

    const filtered = SECTIONS.filter((s) => {
        const matchesSearch = !search || s.courseCode.toLowerCase().includes(search) || s.courseTitle.toLowerCase().includes(search);
        const matchesDept = !dept || s.courseCode.replace(/[0-9]/g, '') === dept;
        return matchesSearch && matchesDept;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<p class="empty">No sections match your search.</p>';
        return;
    }

    for (const section of filtered) {
        const enrolled = enrolledCount(section.id);
        const isFull = enrolled >= section.capacity;
        const record = studentId ? getStudentRecord(studentId) : null;
        const isRegistered = record ? record.sections.includes(section.id) : false;
        const eligibility = studentId ? canRegister(studentId, section) : { ok: false, reason: 'Enter your Student ID first.' };

        const card = document.createElement('div');
        card.className = 'section-card' + (isFull ? ' full' : '') + (isRegistered ? ' registered' : '');

        card.innerHTML = `
            <div class="section-main">
                <h3>${section.courseCode} &mdash; ${section.courseTitle}</h3>
                <p class="meta">Section ${section.section} &bull; ${section.instructor}</p>
                <p class="meta">${formatSchedule(section)} &bull; ${section.room} &bull; ${section.credits} credits</p>
                <p class="seats ${isFull ? 'seats-full' : ''}">${enrolled}/${section.capacity} seats filled</p>
            </div>
            <div class="section-action"></div>
        `;

        const actionDiv = card.querySelector('.section-action');
        if (isRegistered) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-drop';
            btn.textContent = 'Drop';
            btn.addEventListener('click', () => {
                dropSection(studentId, section.id);
                render();
            });
            actionDiv.appendChild(btn);
        } else {
            const btn = document.createElement('button');
            btn.className = 'btn btn-register';
            btn.textContent = isFull ? 'Full' : 'Register';
            btn.disabled = !eligibility.ok;
            btn.addEventListener('click', () => handleRegister(section.id));
            actionDiv.appendChild(btn);
            if (!eligibility.ok && studentId) {
                const reason = document.createElement('p');
                reason.className = 'reason';
                reason.textContent = eligibility.reason;
                actionDiv.appendChild(reason);
            }
        }

        list.appendChild(card);
    }
}

function renderSchedule(studentId, record) {
    const panel = document.getElementById('schedulePanel');
    if (!studentId || !record || record.sections.length === 0) {
        panel.innerHTML = '<p class="empty">No sections registered yet.</p>';
        return;
    }

    const sections = record.sections
        .map((id) => SECTIONS.find((s) => s.id === id))
        .filter(Boolean)
        .sort((a, b) => DAY_ORDER.indexOf(a.days[0]) - DAY_ORDER.indexOf(b.days[0]) || a.start.localeCompare(b.start));

    const totalCredits = sections.reduce((sum, s) => sum + s.credits, 0);

    panel.innerHTML = `
        <p class="credits-total">Total credits: ${totalCredits} / ${MAX_CREDITS}</p>
        <ul class="schedule-list">
            ${sections.map((s) => `<li><strong>${s.courseCode}-${s.section}</strong> ${s.courseTitle}<br><span class="meta">${formatSchedule(s)} &bull; ${s.room}</span></li>`).join('')}
        </ul>
    `;
}

function handleRegister(sectionId) {
    const studentId = document.getElementById('studentIdInput').value.trim();
    const name = document.getElementById('studentNameInput').value.trim();
    const email = document.getElementById('studentEmailInput').value.trim();
    const statusEl = document.getElementById('formStatus');

    if (!studentId || !name) {
        statusEl.textContent = 'Please enter your Student ID and name.';
        statusEl.className = 'form-status error';
        return;
    }

    setCurrentStudentId(studentId);
    saveProfile(studentId, name, email);
    const result = registerSection(studentId, name, email, sectionId);
    if (result.ok) {
        statusEl.textContent = 'Registered successfully.';
        statusEl.className = 'form-status success';
    } else {
        statusEl.textContent = result.reason;
        statusEl.className = 'form-status error';
    }
    render();
}

document.addEventListener('DOMContentLoaded', () => {
    render();

    document.getElementById('studentForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const studentId = document.getElementById('studentIdInput').value.trim();
        const name = document.getElementById('studentNameInput').value.trim();
        const email = document.getElementById('studentEmailInput').value.trim();
        if (!studentId || !name) return;
        setCurrentStudentId(studentId);
        saveProfile(studentId, name, email);
        render();
    });

    document.getElementById('searchInput').addEventListener('input', () => renderSections(getCurrentStudentId()));
    document.getElementById('deptFilter').addEventListener('change', () => renderSections(getCurrentStudentId()));
});
