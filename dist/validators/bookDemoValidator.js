const emailRegex = /.+@.+\..+/;
function readString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function error(msg) {
    return {
        ok: false,
        status: 200,
        body: { success: false, msg, errCls: 'error' },
    };
}
export function validateBookDemoRequest(body) {
    const fullName = readString(body.fullName);
    const email = readString(body.email).toLowerCase();
    const company = readString(body.company);
    const country = readString(body.country);
    const role = readString(body.role);
    const workflow = readString(body.workflow);
    if (!fullName || !email || !company || !country || !role) {
        return error('Please complete all required fields');
    }
    if (!emailRegex.test(email)) {
        return error('Please enter a valid email address');
    }
    return {
        ok: true,
        value: {
            fullName,
            email,
            company,
            country,
            role,
            ...(workflow ? { workflow } : {}),
        },
    };
}
