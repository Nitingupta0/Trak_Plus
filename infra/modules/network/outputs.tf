output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  value = aws_subnet.database[*].id
}

output "security_group_ids" {
  description = "Map of security group names to IDs"
  value = {
    alb      = aws_security_group.alb.id
    backend  = aws_security_group.backend.id
    frontend = aws_security_group.frontend.id
    database = aws_security_group.database.id
    redis    = aws_security_group.redis.id
  }
}