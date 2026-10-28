import { session } from '@/lib/server-auth';
import { failure, HttpError, json } from '@/lib/server-db';
import { bundledScience, scienceFor } from '@/lib/server-science';
export async function GET(request: Request) { try {
    let s;
    try {
        s = await session(request);
    }
    catch (e) {
        if (e instanceof HttpError && e.status === 401)
            return json(bundledScience());
        throw e;
    }
    return json(await scienceFor(s));
}
catch (e) {
    return failure(e);
} }
