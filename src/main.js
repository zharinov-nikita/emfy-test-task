import { callApi } from "./api"

class App {
  activeRequests = []
  currentlyOpenRow = null

  async init() {
    const table = document.querySelector("table")
    const tBody = table?.querySelector("tbody")

    // Очищаем таблицу перед загрузкой (если нужно)
    tBody.innerHTML = ""

    // Создаем 6 строк с лоадерами во ВСЕХ ячейках
    for (let i = 0; i < 6; i++) {
      const skeletonRow = document.createElement("tr")

      // В каждой строке 5 ячеек с лоадерами
      for (let j = 0; j < 5; j++) {
        const cell = document.createElement("td")
        cell.appendChild(this.createSpinnerComponent())
        skeletonRow.appendChild(cell)
      }

      tBody.appendChild(skeletonRow)
    }

    // Теперь загружаем реальные данные
    const leads = await callApi({
      url: "leads?with=contacts,companies"
    })

    // Удаляем все лоадерные строки
    tBody.innerHTML = ""

    if (leads.data) {
      // Создаем строки с реальными данными
      for (const lead of leads.data._embedded.leads) {
        tBody.appendChild(this.createLeadRowWithLoaders(lead))
      }

      // Подгружаем дополнительные данные (компании, телефоны)
      for (let i = 0; i < leads.data._embedded.leads.length; i++) {
        const lead = leads.data._embedded.leads[i]
        const row = tBody.children[i]
        await this.loadAdditionalDataForRow(lead, row)
      }
    }
  }
  createLeadRowWithLoaders(lead) {
    const tr = document.createElement("tr")

    // Основные данные лида
    const idTd = document.createElement("td")
    idTd.textContent = lead.id.toString()

    const nameTd = document.createElement("td")
    nameTd.textContent = lead.name

    const priceTd = document.createElement("td")
    priceTd.textContent = lead.price.toString()

    // Ячейки для компаний и телефонов с лоадерами
    const companiesTd = document.createElement("td")
    companiesTd.appendChild(this.createSpinnerComponent())

    const phonesTd = document.createElement("td")
    phonesTd.appendChild(this.createSpinnerComponent())

    tr.appendChild(idTd)
    tr.appendChild(nameTd)
    tr.appendChild(priceTd)
    tr.appendChild(companiesTd)
    tr.appendChild(phonesTd)

    // Сохраняем исходные данные лида в атрибутах строки
    tr.dataset.leadId = lead.id.toString()
    tr.dataset.leadName = lead.name
    tr.dataset.leadPrice = lead.price.toString()

    // Добавляем обработчик клика для загрузки задач
    tr.onclick = async () => {
      await this.handleRowClick({ tr, lead })
    }

    return tr
  }

  async loadAdditionalDataForRow(lead, row) {
    const companiesIds = lead._embedded.companies
      .filter(company => company)
      .map(company => company.id)
    const contactsIds = lead._embedded.contacts
      .filter(contact => contact)
      .map(contact => contact.id)

    // Загружаем компании и контакты параллельно
    const [companies, contacts] = await Promise.all([
      this.loadCompanies(companiesIds),
      this.loadContacts(contactsIds)
    ])

    const companiesNames = companies.map(company => company?.name || "-")
    const phoneNumbers = contacts.map(
      contact => contact?.custom_fields_values?.[0]?.values?.[0]?.value || "-"
    )

    // Обновляем ячейки с данными
    const companiesTd = row.children[3]
    const phonesTd = row.children[4]

    companiesTd.innerHTML = ""
    companiesTd.textContent = companiesNames.join(", ")

    phonesTd.innerHTML = ""
    phonesTd.textContent = phoneNumbers.join(", ")
  }

  async loadCompanies(ids) {
    if (ids.length === 0) return [null]
    const promises = ids.map(id => callApi({ url: `companies/${id}` }))
    const results = await Promise.all(promises)
    return results.map(res => res.data || null)
  }

  async loadContacts(ids) {
    if (ids.length === 0) return [null]
    const promises = ids.map(id => callApi({ url: `contacts/${id}` }))
    const results = await Promise.all(promises)
    return results.map(res => res.data || null)
  }

  async handleRowClick({ tr, lead }) {
    // Проверяем, есть ли спиннер в ячейках строки (значит, данные ещё грузятся)
    const hasSpinner = Array.from(tr.children).some(node => {
      return node.querySelector(".spinner-border") !== null
    })

    // Если есть спиннер - игнорируем клик
    if (hasSpinner) {
      return alert(
        "Чтобы загрузить дополнительную информацию, дождитесь загрузки всех полей"
      )
    }

    // Отменяем все текущие запросы
    this.cancelActiveRequests()

    // Если кликнули на уже открытую строку - закрываем ее
    if (this.currentlyOpenRow === tr) {
      this.closeExtraRow(tr)
      this.currentlyOpenRow = null
      return
    }

    // Закрываем предыдущую открытую строку, если есть
    if (this.currentlyOpenRow) {
      this.closeExtraRow(this.currentlyOpenRow)
    }

    // Устанавливаем текущую строку как открытую
    this.currentlyOpenRow = tr

    // Сохраняем оригинальное содержимое ячеек
    const originalContents = []
    Array.from(tr.children).forEach(node => {
      originalContents.push(node.textContent || "")
    })

    // Показываем спиннер загрузки
    Array.from(tr.children).forEach(node => {
      node.innerHTML = ""
      node.appendChild(this.createSpinnerComponent())
    })

    try {
      const leadId = tr.dataset.leadId
      if (!leadId) return

      const controller = new AbortController()
      this.activeRequests.push(controller)

      const tasks = await callApi({
        url: `tasks?filter[entity_id]=${leadId}&order[complete_till]=asc&limit=1`,
        signal: controller.signal
      })

      // Удаляем завершенный запрос из списка активных
      this.activeRequests = this.activeRequests.filter(
        req => req !== controller
      )

      // Восстанавливаем оригинальное содержимое ячеек
      Array.from(tr.children).forEach((node, index) => {
        node.textContent = originalContents[index]
      })

      // Добавляем дополнительную информацию
      if (tasks?.data?._embedded?.tasks?.length) {
        this.addExtraRowWithTaskInfo({
          tr,
          task: tasks.data?._embedded.tasks[0],
          lead
        })
      }
    } catch (error) {
      console.error("Ошибка загрузки задач:", error)
      // Восстанавливаем оригинальное содержимое в случае ошибки
      Array.from(tr.children).forEach((node, index) => {
        node.textContent = originalContents[index]
      })
    }
  }

  addExtraRowWithTaskInfo({ tr, task, lead }) {
    const extraRow = document.createElement("tr")
    extraRow.className = "extra-row"
    const extraCell = document.createElement("td")
    extraCell.colSpan = tr.children.length
    extraCell.className = "bg-light"

    if (task && lead) {
      const status = this.getStatusTask(task)
      extraCell.innerHTML = `
        <div class="p-2">
        <div class="d-flex gap-2">        
        <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="8" fill="${status}" stroke="${status}" stroke-width="1"/>
        </svg> 
        <p>Дополнительная информация по <strong>${lead.name}</strong></p>
           </div>

        <div class="p-2">
          <strong>ID:</strong> ${lead.id}<br>
          <strong>Название:</strong> ${lead.name}<br>
          <strong>Дата:</strong> ${this.fortTimestampToDate(lead.created_at)}
        </div>
      `

      extraRow.appendChild(extraCell)
      tr.after(extraRow)
    }
  }

  createSpinnerComponent() {
    const container = document.createElement("div")
    container.className =
      "d-flex justify-content-center align-items-center w-100 h-100"

    const spinner = document.createElement("div")
    spinner.className = "spinner-border spinner-border-sm text-primary"
    spinner.role = "status"

    const srOnly = document.createElement("span")
    srOnly.className = "visually-hidden"
    srOnly.textContent = "Загрузка..."

    spinner.appendChild(srOnly)
    container.appendChild(spinner)

    return container
  }

  closeExtraRow(row) {
    const nextRow = row.nextElementSibling
    if (nextRow && nextRow.classList.contains("extra-row")) {
      nextRow.remove()
    }
  }

  cancelActiveRequests() {
    this.activeRequests.forEach(controller => controller.abort())
    this.activeRequests = []
  }

  getStatusTask(task) {
    if (!task) return "red"

    const now = new Date()
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    )
    const completeDate = new Date(task.complete_till * 1000)
    const taskDayUTC = new Date(
      Date.UTC(
        completeDate.getUTCFullYear(),
        completeDate.getUTCMonth(),
        completeDate.getUTCDate()
      )
    )

    const diffDays = (taskDayUTC.getTime() - todayUTC.getTime()) / 86400000

    if (diffDays < 0) return "red"
    if (diffDays === 0) return "green"
    return "yellow"
  }

  fortTimestampToDate(timestamp) {
    if (!timestamp || isNaN(timestamp)) {
      return "Некорректная дата"
    }

    const date = new Date(timestamp * 1000)

    // Проверка, что дата валидна
    if (isNaN(date.getTime())) {
      return "Некорректная дата"
    }

    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = date.getFullYear()

    return `${day}.${month}.${year}`
  }
}

new App().init()
