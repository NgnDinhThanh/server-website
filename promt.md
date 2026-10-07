Thanh toán/Hóa đơn: Một số vấn đề cần kiểm tra:

- Hiện tại chưa có logic cho việc gửi email hóa đơn từ misa cho người dùng, cần phân biệt rõ:

* Email thông báo đã thanh toán thành công (nhận thanh toán), email thông báo tài khoản đã được active chỉ thông báo cho email đăng ký tài khoản.
* Email yêu cầu gửi hóa đơn khách hàng sau khi thanh toán thành công (đây là email từ misa, gọi từ API của misa) mặc định gửi đến tài khoản đăng ký nếu có yêu cầu xuất hóa đơn (sau khi đã thanh toán thành công), ngoài ra với trường hợp yêu cầu hóa đơn sau khi thanh toán thành công sẽ có checkbox nhận hóa đơn qua email, check vào rồi nhập thêm email nếu muốn nhận từ hóa đơn khác, lưu ý email checkbox ở đây chỉ nhận hóa đơn từ misa.

Thay đổi, cập nhật giao diện:

- Kiểm tra tất cả các trang đều phải có header giống nhau, với route định hướng chuẩn và đầy đủ, hiện tại BLog, Tutorial đang không đồng nhất
- Thay đổi cách sắp xếp, theo thứ tự: Book Free Demo -> Download Free -> Acount logo, Download Free màu trắng.

Yêu cầu giao diện mới:

- 1 trang để ghi nhận góp ý khách hàng, thu nhận zalo tên - sdt - mail - góp ý/đề xuất - video/ảnh mô tả tương ứng > lưu vào 1 folder driver nhé
  Một page có chức năng ghi nhận ý kiến khách hàng, người dùng nhập vào tên, số điện thoại (recommend số có sử dụng zalo), nhập đóng góp, hay đề xuất phát triển cho phần mềm, có thể đính kèm ảnh, rồi video minh họa. Khi gửi đi thì BE xử lý lưu lại vào một forder dựng sẵn trên google driver, có lưu trữ rõ ràng theo từng trường, có thể hiển thị dưới dạng danh sách.
  Hãy suy nghĩ rồi trình bày ý tưởng, kế hoạch.
- Trang này được mở bởi một nav link trên header, ngang cấp với pricing, resource, ...
