import { SettingsForm } from '@/components/admin/settings-form'

export default function SettingsPage() {
    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
                <p className="text-muted-foreground">Configure your blog settings, AI copilot context, and default links.</p>
            </div>

            {/* Settings Form */}
            <SettingsForm />
        </div>
    )
}
