'use client'

export default function ServicesPage() {
  const services = [
    {
      icon: '🎯',
      title: '2-Week Settlement VIP Package',
      description: 'Get all services in one go',
    },
    {
      icon: '📋',
      title: 'Visa Consultation',
      description: 'Expert help with visa applications and requirements',
    },
    {
      icon: '🏠',
      title: 'Housing',
      description: 'Find apartments, share houses, and officetels',
    },
    {
      icon: '📱',
      title: 'Phone Plans',
      description: 'Easy mobile phone setup with local carriers',
    },
    {
      icon: '🏦',
      title: 'Bank Account',
      description: 'Open and set up your Korean bank account',
    },
    {
      icon: '📚',
      title: 'Academy & Classes',
      description: 'Find language schools, universities, and academies',
    },
    {
      icon: '💼',
      title: 'Job Opportunities',
      description: 'Browse part-time and full-time job listings, --- not included in MVP ---',
    },
  ]

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Our Services</h1>
        <p className="text-gray-600">
          Everything you need to settle comfortably in Korea, from day one.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition cursor-pointer"
          >
            <div className="text-4xl mb-3">{service.icon}</div>
            <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
            <p className="text-gray-600 text-sm">{service.description}</p>
            <button className="mt-4 text-sm font-semibold text-[#9DB8A0] hover:underline">
              Learn more →
            </button>
          </div>
        ))}
      </div>

    </div>
  )
}
