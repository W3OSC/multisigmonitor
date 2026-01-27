use crate::worker::notifications::Alert;

pub fn generate_email_html(alert: &Alert) -> String {
    let safe_app_link = format!(
        "https://app.safe.global/transactions/tx?safe={}:{}&id=multisig_{}_{}",
        alert.network, alert.safe_address, alert.safe_address, alert.transaction_hash
    );

    format!(
        r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }}
        .container {{ max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .header {{ background: linear-gradient(135deg, #8052ff 0%, #6941d9 100%); color: #ffffff; padding: 30px; text-align: center; }}
        .header h1 {{ margin: 0; font-size: 24px; font-weight: 600; }}
        .content {{ padding: 30px; }}
        .alert-box {{ background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 4px; }}
        .info-row {{ margin-bottom: 15px; }}
        .info-label {{ font-weight: 600; color: #666; font-size: 14px; }}
        .info-value {{ color: #333; font-size: 14px; word-break: break-all; }}
        .button {{ display: inline-block; padding: 12px 24px; background-color: #8052ff; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500; margin-top: 20px; }}
        .footer {{ background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }}
        .code {{ font-family: 'Courier New', monospace; background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 13px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔔 Transaction Alert</h1>
        </div>
        <div class="content">
            <div class="alert-box">
                <strong>{}</strong>
            </div>
            <div class="info-row">
                <div class="info-label">Network</div>
                <div class="info-value">{}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Safe Address</div>
                <div class="info-value"><span class="code">{}</span></div>
            </div>
            <div class="info-row">
                <div class="info-label">Description</div>
                <div class="info-value">{}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Transaction Nonce</div>
                <div class="info-value">{}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Status</div>
                <div class="info-value">{}</div>
            </div>
            <a href="{}" class="button">View in Safe App</a>
        </div>
        <div class="footer">
            <p>This is an automated notification from MultisigMonitor</p>
        </div>
    </div>
</body>
</html>
"#,
        match alert.alert_type {
            super::AlertType::Suspicious => "⚠️ SUSPICIOUS TRANSACTION DETECTED",
            super::AlertType::Management => "🔧 Safe Configuration Change",
            super::AlertType::Normal => "📝 New Transaction",
        },
        alert.network,
        alert.safe_address,
        alert.description,
        alert.nonce,
        if alert.is_executed { "✅ Executed" } else { "⏳ Awaiting execution" },
        safe_app_link
    )
}

pub fn generate_email_text(alert: &Alert) -> String {
    let safe_app_link = format!(
        "https://app.safe.global/transactions/tx?safe={}:{}&id=multisig_{}_{}",
        alert.network, alert.safe_address, alert.safe_address, alert.transaction_hash
    );

    format!(
        "{}\n\n\
        Network: {}\n\
        Safe Address: {}\n\
        Description: {}\n\
        Transaction Nonce: {}\n\
        Status: {}\n\n\
        View in Safe App: {}",
        match alert.alert_type {
            super::AlertType::Suspicious => "⚠️ SUSPICIOUS TRANSACTION DETECTED",
            super::AlertType::Management => "🔧 Safe Configuration Change",
            super::AlertType::Normal => "📝 New Transaction",
        },
        alert.network,
        alert.safe_address,
        alert.description,
        alert.nonce,
        if alert.is_executed { "Executed" } else { "Awaiting execution" },
        safe_app_link
    )
}
