'use server';

interface SubscribePayload {
    email: string;
    tags?: string[];
    temp_session_id?: string;
}

interface SubscribeResponse {
    success: boolean;
    error?: string;
    id?: string;
}

export async function subscribeToNewsletter(payload: SubscribePayload): Promise<SubscribeResponse> {
    try {
        const response = await fetch("https://email.dreamplaypianos.com/api/webhooks/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...payload,
                first_name: "",
            })
        });

        if (!response.ok) {
            // If the error is "email already exists", treat as success
            if (response.status === 400 || response.status === 422) {
                console.log("Subscriber likely already exists, proceeding anyway.");
                return { success: true };
            }

            let errorMessage = "Failed to subscribe";
            try {
                const errorData = await response.json();
                if (errorData.error) errorMessage = errorData.error;
            } catch (e) {
                // failed to parse json
            }
            console.error('Subscription API error:', response.status, errorMessage);
            return { success: false, error: errorMessage };
        }

        const data = await response.json();
        return { success: true, id: data.id };

    } catch (error: any) {
        console.error('Server Action subscription error:', error);
        return { success: false, error: error.message || "Internal server error" };
    }
}
