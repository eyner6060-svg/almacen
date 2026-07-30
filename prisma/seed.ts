import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {

  // Crear oficina principal
  const office = await prisma.office.upsert({
    where: { code: 'DT-001' },
    update: {},
    create: {
      name: 'Dirección de Telecomunicaciones',
      code: 'DT-001',
      description: 'Dirección de Telecomunicaciones'
    }
  })

  console.log('Oficina creada:', office)

  // Crear usuario administrador
  const hashedPassword = await bcrypt.hash('Admin123!', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@dtel.com' },
    update: {},
    create: {
      fullName: 'Administrador del Sistema',
      dni: '00000000',
      phone: '0000000000',
      position: 'Administrador',
      email: 'admin@dtel.com',
      password: hashedPassword,
      pin: await bcrypt.hash('1234', 10),
      role: Role.ADMINISTRADOR,
      officeId: office.id
    }
  })

  console.log('Usuario admin creado:', admin.email)

  // Crear estados por defecto
  const defaultEstados = [
    { name: 'OPERATIVO', label: 'Operativo', color: 'green' },
    { name: 'AVERIADO', label: 'Averiado', color: 'yellow' },
    { name: 'INOPERATIVO', label: 'Inoperativo', color: 'red' },
    { name: 'NUEVO', label: 'Nuevo', color: 'blue' },
    { name: 'EN REPARACIÓN', label: 'En Reparación', color: 'orange'},
    { name: 'ALMACENADO', label: 'Almacenado', color: 'pink'},
    { name: 'USADO', label: 'Usado', color: 'purple'}
  ]
  
  for (const est of defaultEstados) {
    await prisma.itemStatusEnum.upsert({
      where: { name: est.name },
      update: {},
      create: est
    })
  }
  console.log('Estados por defecto creados')

  console.log('=== SEMILLA COMPLETADA ===')
  console.log('Usuario admin: admin@dtel.com')
  console.log('Contraseña: Admin123!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
