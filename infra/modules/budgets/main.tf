resource "aws_budgets_budget" "monthly" {
  name         = "${var.project_name}-${var.environment}-monthly"
  budget_type  = "COST"
  limit_amount = var.monthly_limit_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Notifications are only valid with at least one subscriber — emit none
  # when email_recipients is empty (e.g. free-tier/dev runs).
  dynamic "notification" {
    for_each = length(var.email_recipients) > 0 ? [1] : []
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = 80
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = var.email_recipients
    }
  }

  dynamic "notification" {
    for_each = length(var.email_recipients) > 0 ? [1] : []
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = 100
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = var.email_recipients
    }
  }
}
