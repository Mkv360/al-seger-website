document.addEventListener("DOMContentLoaded", () => {
  const colRight = document.querySelector(".col-right");
  const portrait = document.querySelector(".portrait-wrap");

  if (!colRight || !portrait) return;

  const idWrap = document.getElementById("idWrap");
  if (!idWrap) return;

  const idCard = idWrap.closest(".doc-card");
  if (!idCard) return;

  const wrapper = document.createElement("div");
  wrapper.id = "idTopBox";

  wrapper.appendChild(idCard);
  colRight.insertBefore(wrapper, portrait);
});