const contactForm = document.getElementById("contactForm");

if (contactForm) {
  contactForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = {
      name: this.name.value,
      phone: this.phone.value,
      country: this.country.value,
      message: this.message.value,
      time: new Date().toISOString()
    };

    // store message (acts like admin inbox for now)
    let messages = JSON.parse(localStorage.getItem("messages")) || [];
    messages.push(formData);
    localStorage.setItem("messages", JSON.stringify(messages));

    alert("Message sent successfully!");

    this.reset();
  });
}

const messages = JSON.parse(localStorage.getItem("messages")) || [];

console.log(messages);

function deleteMessage(index) {
  let messages = JSON.parse(localStorage.getItem("messages")) || [];
  messages.splice(index, 1);
  localStorage.setItem("messages", JSON.stringify(messages));
  location.reload();
}