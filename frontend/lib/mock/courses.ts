export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type Course = {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  status: CourseStatus;
  thumbnailKey: string | null;
  instructorId: string;
  createdAt: string;
  updatedAt: string;
};

export const mockCourses: Course[] = [
  {
    id: "1",
    title: "Lập trình JavaScript",
    slug: "lap-trinh-js",
    description: "Nền tảng JS từ ES6 đến bất đồng bộ, closure và prototype.",
    price: 0,
    status: "PUBLISHED",
    thumbnailKey: null,
    instructorId: "u1",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    id: "2",
    title: "React & Next.js Masterclass",
    slug: "react-nextjs-masterclass",
    description: "Xây dựng ứng dụng Fullstack với App Router, Server Components và SSR.",
    price: 12900000, // 1.290.000 VNĐ
    status: "PUBLISHED",
    thumbnailKey: "courses/react-next.jpg",
    instructorId: "u1",
    createdAt: "2026-02-15",
    updatedAt: "2026-02-15",
  },
  {
    id: "3",
    title: "Node.js & Express Backend",
    slug: "nodejs-express-backend",
    description: "Thiết kế RESTful API, Authentication (JWT/OAuth), và xử lý lỗi.",
    price: 9900000,
    status: "PUBLISHED",
    thumbnailKey: "courses/node-express.jpg",
    instructorId: "u2",
    createdAt: "2026-03-01",
    updatedAt: "2026-03-01",
  },
  {
    id: "4",
    title: "Python & Django Framework",
    slug: "python-django-framework",
    description: "Backend Python, Django ORM, DRF (Django REST Framework) và Deploy.",
    price: 10900000,
    status: "PUBLISHED",
    thumbnailKey: "courses/python-django.jpg",
    instructorId: "u2",
    createdAt: "2026-03-10",
    updatedAt: "2026-03-10",
  },
  {
    id: "5",
    title: "PostgreSQL & Database Design",
    slug: "postgresql-database-design",
    description: "Thiết kế schema chuẩn hóa, Indexing, Query Optimization và Transactions.",
    price: 7900000,
    status: "PUBLISHED",
    thumbnailKey: "courses/postgres-db.jpg",
    instructorId: "u3",
    createdAt: "2026-04-05",
    updatedAt: "2026-04-05",
  },
  {
    id: "6",
    title: "TypeScript Advanced Patterns",
    slug: "typescript-advanced-patterns",
    description: "Generics, Utility Types, Conditional Types và Type-safe API.",
    price: 8900000,
    status: "PUBLISHED",
    thumbnailKey: "courses/ts-advanced.jpg",
    instructorId: "u1",
    createdAt: "2026-05-12",
    updatedAt: "2026-05-12",
  },
  {
    id: "7",
    title: "Docker & CI/CD Pipeline",
    slug: "docker-cicd-pipeline",
    description: "Containerization, Docker Compose, GitHub Actions và Auto-deploy.",
    price: 11900000,
    status: "PUBLISHED",
    thumbnailKey: "courses/docker-cicd.jpg",
    instructorId: "u4",
    createdAt: "2026-06-20",
    updatedAt: "2026-06-20",
  },
  {
    id: "8",
    title: "System Design cho Web App",
    slug: "system-design-web-app",
    description: "Load Balancer, Caching, Message Queue, Microservices và Scalability.",
    price: 14900000,
    status: "DRAFT", // Đang biên soạn
    thumbnailKey: null,
    instructorId: "u4",
    createdAt: "2026-08-01",
    updatedAt: "2026-09-15",
  },
  {
    id: "9",
    title: "Tailwind CSS & UI Engineering",
    slug: "tailwind-ui-engineering",
    description: "Utility-first CSS, Responsive Design, Darkmode và Animation.",
    price: 0, // Khóa học miễn phí
    status: "PUBLISHED",
    thumbnailKey: "courses/tailwind-ui.jpg",
    instructorId: "u1",
    createdAt: "2026-09-01",
    updatedAt: "2026-09-01",
  },
  {
    id: "10",
    title: "NixOS & Linux for Developers",
    slug: "nixos-linux-devs",
    description: "Quản lý package declarative, reproducible environments, Neovim config.",
    price: 0,
    status: "PUBLISHED",
    thumbnailKey: "courses/nixos-dev.jpg",
    instructorId: "u5",
    createdAt: "2026-10-01",
    updatedAt: "2026-10-30",
  },
];

export async function getCourses(): Promise<Course[]> {
  return mockCourses;   // sau này thay bằng fetch API
}