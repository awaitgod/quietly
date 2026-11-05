export const externalApi = {
    fetchExternalIp: async (): Promise<string> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        try {
            const res = await fetch('https://api.ipify.org?format=json', {
                signal: controller.signal,
            });
            clearTimeout(timer);
            if (res.ok) {
                const json = await res.json();
                if (json.ip)
                    return json.ip;
            }
        }
        catch {
            try {
                const res64 = await fetch('https://api64.ipify.org?format=json', {
                    signal: controller.signal,
                });
                clearTimeout(timer);
                if (res64.ok) {
                    const json = await res64.json();
                    if (json.ip)
                        return json.ip;
                }
            }
            catch {
            }
        }
        return '127.0.0.1';
    },
    getAppleEmojiUrl: (hexCodepoints: string): string => {
        return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/${hexCodepoints.toLowerCase()}.png`;
    },
};
