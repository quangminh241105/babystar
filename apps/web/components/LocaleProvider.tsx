"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Locale = "en" | "vi";
const translations: Record<string, string> = {
  "BabyStar is an educational wellness companion, not a replacement for professional medical advice.": "BabyStar cung cấp thông tin tham khảo, không thay thế tư vấn y tế chuyên nghiệp.",
  "Track": "Theo dõi", "Reports": "Báo cáo", "Plans": "Kế hoạch", "Assistant": "Trợ lý", "Partner": "Người đồng hành",
  "Log in": "Đăng nhập", "Log out": "Đăng xuất", "Join BabyStar": "Tham gia", "Menu": "Danh mục", "Close": "Đóng",
  "A gentler way to track pregnancy": "Theo dõi thai kỳ nhẹ nhàng hơn", "Your pregnancy, held with care.": "Hành trình thai kỳ, được chăm sóc.",
  "BabyStar brings your health notes, weekly insights, movement, nutrition, and support into one calm space built for the journey ahead.": "BabyStar kết nối nhật ký sức khỏe, báo cáo hằng tuần, vận động, dinh dưỡng và hỗ trợ trong một không gian rõ ràng.",
  "Start your journey": "Bắt đầu hành trình", "I already have an account": "Tôi đã có tài khoản", "Sign in with Google": "Đăng nhập bằng Google",
  "One thoughtful home": "Một nơi dành cho bạn", "Everything you need to feel more in tune.": "Mọi thứ cần thiết để hiểu cơ thể mình hơn.",
  "Daily health logs": "Nhật ký sức khỏe", "Weekly reports": "Báo cáo hằng tuần", "A companion when you need one": "Luôn có người đồng hành",
  "Understand": "Thấu hiểu", "Support": "Hỗ trợ", "Week by week": "Từng tuần thai", "Personalized, practical, reassuring.": "Cá nhân hóa, thiết thực, an tâm.",
  "Welcome back": "Chào mừng trở lại", "Sign in to BabyStar": "Đăng nhập BabyStar", "Your notes and progress are waiting for you.": "Nhật ký và tiến trình của bạn đang chờ.",
  "Email or phone": "Email hoặc số điện thoại", "Password": "Mật khẩu", "Sign in": "Đăng nhập", "Signing in…": "Đang đăng nhập…", "New to BabyStar?": "Bạn mới đến BabyStar?", "Create an account": "Tạo tài khoản", "or": "hoặc",
  "Begin gently": "Bắt đầu nhẹ nhàng", "Create your space": "Tạo không gian của bạn", "Full name": "Họ và tên", "Email": "Email", "Phone number": "Số điện thoại", "Confirm password": "Xác nhận mật khẩu", "Create account": "Tạo tài khoản", "Creating…": "Đang tạo…", "Already registered?": "Đã có tài khoản?",
  "Administration": "Quản trị", "BabyStar operations": "Điều hành BabyStar", "Manage account access and content from one place.": "Quản lý tài khoản, nội dung và dữ liệu minh họa tại đây.",
  "Manage quizzes": "Quản lý câu hỏi", "Users": "Người dùng", "Active": "Đang hoạt động", "Deactivate": "Vô hiệu hóa", "Activate": "Kích hoạt",
  "Demo data": "Dữ liệu minh họa", "Generate 500": "Tạo 500 mẫu", "Remove demo data": "Xóa dữ liệu mẫu", "No demo users": "Chưa có dữ liệu mẫu",
  "Profile": "Hồ sơ", "Notifications": "Thông báo", "Health": "Sức khỏe", "Nutrition": "Dinh dưỡng", "Exercise": "Vận động",
  "A wider view": "Góc nhìn rộng hơn", "Weekly report": "Báo cáo hằng tuần", "Patterns to notice, not numbers to fear.": "Theo dõi xu hướng, không lo lắng vì con số.",
  "Together, with boundaries": "Đồng hành theo cách của bạn", "Partner sharing": "Chia sẻ với người thân", "Invite someone you trust and decide what they can see.": "Mời người bạn tin tưởng và chọn thông tin họ có thể xem.",
  "A little guidance for this week": "Gợi ý cho tuần này", "Personalized context with room for your own judgment and care team.": "Thông tin tham khảo theo thai kỳ, cùng với tư vấn của đội ngũ y tế.",
  "Learn together": "Cùng tìm hiểu", "Little quizzes": "Câu hỏi nhỏ", "A light way to explore pregnancy and prepare questions.": "Khám phá kiến thức thai kỳ và chuẩn bị câu hỏi.",
  "Your timeline": "Dòng thời gian", "Past health records": "Nhật ký sức khỏe trước đây", "A private, chronological view of your check-ins.": "Xem lại nhật ký của bạn theo thời gian.",
  "Care, closer to you": "Chăm sóc gần bạn", "Nearby healthcare": "Cơ sở y tế gần đây", "Find hospitals, clinics, and pharmacies around your current location.": "Tìm bệnh viện, phòng khám và nhà thuốc quanh vị trí của bạn.",
  "Stay in the loop": "Luôn được cập nhật", "Reminders, progress updates, and partner activity.": "Lời nhắc, cập nhật tiến trình và hoạt động của người thân.",
  "Content": "Nội dung", "Quiz library": "Thư viện câu hỏi", "Review the learning content available to members.": "Xem nội dung học tập dành cho thành viên.",
};

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (value: string) => string };
const LocaleContext = createContext<LocaleContextValue>({ locale: "en", setLocale: () => undefined, t: (value) => value });

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  useEffect(() => {
    const saved = localStorage.getItem("babystar-locale");
    const next = saved === "en" || saved === "vi" ? saved : navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en";
    setLocaleState(next);
    document.documentElement.lang = next;
  }, []);
  function setLocale(next: Locale) {
    setLocaleState(next);
    localStorage.setItem("babystar-locale", next);
    document.documentElement.lang = next;
  }
  return <LocaleContext.Provider value={{ locale, setLocale, t: (value) => locale === "vi" ? translations[value] || value : value }}>{children}</LocaleContext.Provider>;
}

export function useLocale() { return useContext(LocaleContext); }
