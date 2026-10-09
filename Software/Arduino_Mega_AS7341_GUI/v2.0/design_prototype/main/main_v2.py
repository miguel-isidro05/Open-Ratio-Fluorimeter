"""Spectral Lab v2: interfaz PyQt6 con la distribución del prototipo aprobado.

La clase reutiliza la lógica de :mod:`desktop_gui.main_window` (serial,
telemetría, grabación, experimentos y resultados) y sustituye solamente la
composición visual. Puede ejecutarse directamente desde cualquier directorio.
"""

from __future__ import annotations

import sys
from pathlib import Path
from time import monotonic


VERSION_ROOT = Path(__file__).resolve().parents[2]
DESKTOP_GUI = VERSION_ROOT / "desktop_gui"
if str(DESKTOP_GUI) not in sys.path:
    sys.path.insert(0, str(DESKTOP_GUI))

from PyQt6.QtCore import Qt  # noqa: E402
from PyQt6.QtGui import QFontDatabase, QPixmap, QTextBlockFormat, QTextCursor  # noqa: E402
from PyQt6.QtWidgets import (  # noqa: E402
    QApplication,
    QComboBox,
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QPlainTextEdit,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QSpinBox,
    QStackedWidget,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from display_mirror import DisplayMirror  # noqa: E402
from experiments import Experiments  # noqa: E402
from main_window import GAINS, INTEGRATION_TIMES, MainWindow  # noqa: E402
from protocol import CHANNEL_KEYS  # noqa: E402
from results_quality import ResultsQuality  # noqa: E402
from spectral_plot import SpectralPlot  # noqa: E402


LOGO_PATH = VERSION_ROOT / "design_prototype" / "assets" / "upch_logo_transparent.png"


STYLE_V2 = """
QMainWindow, QWidget#appRoot { background: #f3f5f7; color: #142b40; }
QWidget { font-family: "SF Pro Text", "Inter", "Segoe UI", sans-serif; font-size: 12px; }
QFrame#topBar { background: #102536; border-bottom: 1px solid #294256; }
QLabel#productName { color: #ffffff; font-size: 18px; font-weight: 650; }
QLabel#productCaption { color: #b8c8d5; font-size: 11px; }
QLabel#topStatus { color: #d9e3eb; padding: 0 12px; }
QPushButton#navButton {
    color: #c9d5df; background: transparent; border: none; border-radius: 0;
    min-height: 61px; padding: 0 18px; font-size: 13px; font-weight: 550;
}
QPushButton#navButton:hover { background: #183246; color: white; }
QPushButton#navButton:checked {
    color: white; background: #183246; border-bottom: 3px solid #72a5ff; font-weight: 650;
}
QFrame#connectionCard, QFrame#card {
    background: #ffffff; border: 1px solid #d5dee7; border-radius: 10px;
}
QFrame#subCard { background: #f8fafc; border: 1px solid #e0e7ee; border-radius: 8px; }
QFrame#sidePanel { background: #f8fafc; border: 1px solid #d5dee7; border-radius: 9px; }
QFrame#plotEmptyState { background: transparent; border: none; }
QLabel#sectionTitle { color: #142b40; font-size: 14px; font-weight: 650; }
QLabel#panelTitle { color: #142b40; font-size: 13px; font-weight: 650; }
QLabel#caption, QLabel#secondaryText { color: #607488; font-size: 11px; }
QLabel#connectionBadge {
    color: #52677a; background: #f2f5f8; border: 1px solid #d5dee7;
    border-radius: 7px; padding: 7px 10px;
}
QPushButton {
    min-height: 30px; padding: 2px 11px; color: #1457c8; background: #ffffff;
    border: 1px solid #c7d3df; border-radius: 7px; font-weight: 580;
}
QPushButton:hover { background: #f6f9fd; border-color: #9fb2c4; }
QPushButton:pressed { background: #eaf1f8; }
QPushButton#primary { color: white; background: #1457c8; border-color: #1457c8; }
QPushButton#primary:hover { background: #0f49aa; border-color: #0f49aa; }
QPushButton#recordButton { color: #142b40; }
QPushButton#recordButton[recording="true"] { color: white; background: #b42318; border-color: #b42318; }
QPushButton:disabled, QComboBox:disabled, QSpinBox:disabled {
    color: #8b99a7; background: #f1f4f7; border-color: #dbe2e9;
}
QComboBox, QSpinBox {
    min-height: 30px; padding: 2px 8px; color: #142b40; background: white;
    border: 1px solid #c7d3df; border-radius: 7px;
}
QComboBox:focus, QSpinBox:focus, QPushButton:focus { border: 2px solid #6ea2ff; }
QTableWidget {
    color: #142b40; background: white; alternate-background-color: #f7f9fb;
    gridline-color: #e1e7ed; border: 1px solid #d5dee7;
    selection-background-color: #e8f0fc; selection-color: #142b40;
}
QHeaderView::section {
    color: #31485d; background: #eef3f7; border: none; border-right: 1px solid #d5dee7;
    border-bottom: 1px solid #d5dee7; padding: 7px; font-weight: 650;
}
QPlainTextEdit { color: #dce7f3; background: #102536; border: none; border-radius: 7px; padding: 7px; }
QPlainTextEdit#technicalLog { font-family: "SF Mono", "Menlo", "Monaco", monospace; font-size: 10px; }
QScrollArea { background: transparent; border: none; }
QTabWidget::pane { background: white; border: 1px solid #d5dee7; }
QTabBar::tab {
    color: #52677a; background: #f4f7fa; border: none; border-bottom: 3px solid transparent;
    padding: 9px 14px; margin-right: 2px;
}
QTabBar::tab:selected { color: #1457c8; background: white; border-bottom-color: #1457c8; font-weight: 650; }
QGroupBox { background: white; border: 1px solid #d5dee7; border-radius: 8px; margin-top: 12px; padding: 12px 9px 9px; font-weight: 600; }
QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 5px; color: #31485d; }
QLabel#mirrorStatus, QLabel#result { color: #174f58; background: #e6f1f1; border-radius: 7px; padding: 8px 10px; font-weight: 600; }
QStatusBar { color: #52677a; background: #edf2f6; border-top: 1px solid #d5dee7; }
QStatusBar::item { border: none; }
"""


class MainWindowV2(MainWindow):
    """Ventana funcional con el shell visual del prototipo HTML aprobado."""

    NAVIGATION = ("Adquisición", "Instrumento", "Experimentos", "Resultados")

    def __init__(self, session_dir=None, records_dir=None) -> None:
        super().__init__(session_dir=session_dir, records_dir=records_dir)
        self.setWindowTitle("Spectral Lab — AS7341 Workstation")
        self.setMinimumSize(1180, 720)
        self.resize(1600, 1000)
        self.refresh_link_status()

    def _build_interface(self) -> None:
        root = QWidget(self)
        root.setObjectName("appRoot")
        shell = QVBoxLayout(root)
        shell.setContentsMargins(0, 0, 0, 0)
        shell.setSpacing(0)
        shell.addWidget(self._top_bar())
        shell.addWidget(self._connection_card())

        self.workspace = QStackedWidget()
        self.workspace.setContentsMargins(0, 0, 0, 0)
        self.workspace.addWidget(self._acquisition_page())

        self.mirror = DisplayMirror(self)
        self.mirror.command_requested.connect(self.client.send)
        self._modernize_mirror(self.mirror)
        self.workspace.addWidget(self._workspace_scroll(self.mirror, "instrumentScroll"))

        self.experiments = Experiments(self)
        self._modernize_experiments(self.experiments)
        self.experiments.sample_id.textChanged.connect(self._sync_sample_id)
        self.experiments.setMinimumHeight(690)
        self.workspace.addWidget(self._workspace_scroll(self.experiments, "experimentsScroll"))

        self.results_quality = ResultsQuality(self)
        self._modernize_results(self.results_quality)
        self.results_quality.setMinimumHeight(650)
        self.workspace.addWidget(self._workspace_scroll(self.results_quality, "resultsScroll"))

        # Alias de compatibilidad: el código anterior expone el contenedor como tabs.
        self.tabs = self.workspace
        self.experiments.data_changed.connect(self.results_quality.set_session)
        self.results_quality.open_requested.connect(self.open_results_session)
        self.results_quality.set_session(self.experiments.session_data())
        shell.addWidget(self.workspace, 1)
        self.setCentralWidget(root)
        self.setStyleSheet(STYLE_V2)

    def _top_bar(self) -> QFrame:
        bar = QFrame()
        bar.setObjectName("topBar")
        bar.setFixedHeight(64)
        layout = QHBoxLayout(bar)
        layout.setContentsMargins(16, 0, 16, 0)
        layout.setSpacing(14)

        logo = QLabel()
        logo.setObjectName("institutionLogo")
        logo.setAccessibleName("Universidad Peruana Cayetano Heredia")
        logo.setFixedSize(202, 46)
        pixmap = QPixmap(str(LOGO_PATH))
        if pixmap.isNull():
            logo.setText("UPCH")
        else:
            logo.setPixmap(pixmap.scaled(logo.size(), Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
        layout.addWidget(logo)

        identity = QVBoxLayout()
        identity.setContentsMargins(0, 8, 24, 7)
        identity.setSpacing(0)
        name = QLabel("Spectral Lab")
        name.setObjectName("productName")
        caption = QLabel("AS7341 Workstation")
        caption.setObjectName("productCaption")
        identity.addWidget(name)
        identity.addWidget(caption)
        layout.addLayout(identity)
        layout.addStretch(1)

        self.navigation_buttons: list[QPushButton] = []
        for index, title in enumerate(self.NAVIGATION):
            button = QPushButton(title)
            button.setObjectName("navButton")
            button.setCheckable(True)
            button.setAutoExclusive(True)
            button.setChecked(index == 0)
            button.clicked.connect(lambda checked=False, page=index: self._select_workspace(page))
            self.navigation_buttons.append(button)
            layout.addWidget(button)

        layout.addStretch(1)
        help_button = QPushButton("?")
        help_button.setAccessibleName("Ayuda")
        help_button.setObjectName("navButton")
        help_button.setFixedWidth(44)
        layout.addWidget(help_button)
        self.top_connection_status = QLabel("○  Sin conexión")
        self.top_connection_status.setObjectName("topStatus")
        layout.addWidget(self.top_connection_status)
        return bar

    def _connection_card(self) -> QWidget:
        host = QWidget()
        host.setFixedHeight(76)
        outer = QHBoxLayout(host)
        outer.setContentsMargins(18, 8, 18, 8)
        card = QFrame()
        card.setObjectName("connectionCard")
        layout = QHBoxLayout(card)
        layout.setContentsMargins(12, 8, 12, 8)
        layout.setSpacing(10)

        layout.addWidget(self._label("Puerto USB", "panelTitle"))
        self.port_selector = QComboBox()
        self.port_selector.setMinimumWidth(220)
        self.port_selector.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        layout.addWidget(self.port_selector, 2)
        refresh = QPushButton("↻")
        refresh.setAccessibleName("Actualizar puertos")
        refresh.setToolTip("Actualizar puertos USB")
        refresh.setFixedWidth(38)
        refresh.clicked.connect(self.refresh_ports)
        layout.addWidget(refresh)
        self.connect_button = QPushButton("Conectar")
        self.connect_button.setObjectName("primary")
        self.connect_button.clicked.connect(self.toggle_connection)
        layout.addWidget(self.connect_button)
        self.connection_status = QLabel("○  Desconectado")
        self.connection_status.setObjectName("connectionBadge")
        layout.addWidget(self.connection_status)

        divider = QFrame()
        divider.setFrameShape(QFrame.Shape.VLine)
        divider.setStyleSheet("color:#d5dee7;")
        layout.addWidget(divider)
        layout.addWidget(self._label("Muestra", "panelTitle"))
        self.sample_selector = QComboBox()
        self.sample_selector.addItem("Sin asignar")
        self.sample_selector.setMinimumWidth(170)
        layout.addWidget(self.sample_selector, 1)
        new_sample = QPushButton("Nueva muestra")
        new_sample.setToolTip("Asigna el ID en el panel Experimentos")
        new_sample.clicked.connect(lambda: self._select_workspace(2))
        layout.addWidget(new_sample)
        layout.addStretch(1)

        self.record_button = QPushButton("●  Iniciar grabación")
        self.record_button.setObjectName("recordButton")
        self.record_button.setProperty("recording", False)
        self.record_button.clicked.connect(self.toggle_recording)
        layout.addWidget(self.record_button)
        self.record_status = QLabel("○  Sin grabar")
        self.record_status.setObjectName("caption")
        self.record_status.setMaximumWidth(120)
        layout.addWidget(self.record_status)
        outer.addWidget(card)
        return host

    def _acquisition_page(self) -> QWidget:
        page = QWidget()
        layout = QHBoxLayout(page)
        layout.setContentsMargins(18, 10, 18, 12)
        layout.setSpacing(12)
        self.acquisition_sidebar = self._acquisition_controls()
        layout.addWidget(self.acquisition_sidebar)
        layout.addWidget(self._plot_card(), 1)
        self.readout_panel = self._readout_card()
        layout.addWidget(self.readout_panel)
        return page

    def _acquisition_controls(self) -> QFrame:
        panel = QFrame()
        panel.setObjectName("card")
        panel.setFixedWidth(278)
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(14, 14, 14, 14)
        layout.setSpacing(10)
        layout.addWidget(self._label("Parámetros de adquisición", "sectionTitle"))

        sensor = self._subcard("Sensor AS7341")
        sensor_layout = sensor.layout()
        self.gain_selector = self._selector(GAINS, lambda value: self.send_setting("set_gain", value))
        self.integration_selector = self._selector(INTEGRATION_TIMES, lambda value: self.send_setting("set_integration", value))
        self.gain_selector.setCurrentText("128x")
        self.integration_selector.setCurrentText("300ms")
        sensor_layout.addLayout(self._field("Ganancia", self.gain_selector))
        sensor_layout.addLayout(self._field("Integración", self.integration_selector))
        mode = QComboBox()
        mode.addItem("10 canales")
        mode.setEnabled(False)
        sensor_layout.addLayout(self._field("Modo", mode))
        layout.addWidget(sensor)

        light = self._subcard("Iluminación")
        light_layout = light.layout()
        self.pwm_control = QSpinBox()
        self.pwm_control.setRange(0, 100)
        self.pwm_control.setValue(25)
        self.pwm_control.setSuffix(" %")
        self.pwm_control.setKeyboardTracking(False)
        self.pwm_control.valueChanged.connect(lambda value: self.send_setting("set_pwm", value))
        light_layout.addLayout(self._field("PWM LED", self.pwm_control))
        source = QComboBox()
        source.addItem("Externa")
        source.setEnabled(False)
        light_layout.addLayout(self._field("Fuente", source))
        led_state = QLabel("○  Apagada")
        light_layout.addLayout(self._field("Estado", led_state))
        test_led = QPushButton("Probar LED")
        test_led.setEnabled(False)
        light_layout.addWidget(test_led)
        layout.addWidget(light)

        view = self._subcard("Visualización")
        view_layout = view.layout()
        self.scale_label = QLabel("Escala Y")
        self.scale_maximum = QSpinBox()
        self.scale_maximum.setRange(1, 65535)
        self.scale_maximum.setValue(2000)
        self.scale_maximum.setKeyboardTracking(False)
        self.scale_maximum.valueChanged.connect(lambda value: self.plot.set_maximum(value))
        self.auto_scale_button = QPushButton("Automática")
        self.auto_scale_button.setCheckable(True)
        self.auto_scale_button.toggled.connect(self.toggle_auto_scale)
        self.auto_scale_button.setChecked(True)
        view_layout.addLayout(self._field("Escala Y", self.auto_scale_button))
        view_layout.addLayout(self._field("Máximo", self.scale_maximum))
        self.pause_plot_button = QPushButton("Pausar gráfica")
        self.pause_plot_button.setCheckable(True)
        self.pause_plot_button.toggled.connect(self.toggle_plot_pause)
        view_layout.addWidget(self.pause_plot_button)
        layout.addWidget(view)
        layout.addStretch(1)

        self.log = QPlainTextEdit()
        self.log.setObjectName("technicalLog")
        self.log.setReadOnly(True)
        self.log.setMaximumBlockCount(100)
        terminal_font = QFontDatabase.systemFont(QFontDatabase.SystemFont.FixedFont)
        terminal_font.setPixelSize(10)
        self.log.setFont(terminal_font)
        self.log.setLineWrapMode(QPlainTextEdit.LineWrapMode.NoWrap)
        self.log.document().setDocumentMargin(5)
        self.log.setFixedHeight(66)
        self.log.setAccessibleName("Actividad técnica")
        layout.addWidget(self.log)
        return panel

    def _plot_card(self) -> QFrame:
        card = QFrame()
        card.setObjectName("card")
        layout = QVBoxLayout(card)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        header = QWidget()
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(14, 12, 12, 10)
        title_box = QVBoxLayout()
        title_box.setSpacing(1)
        title_box.addWidget(self._label("Espectro en vivo", "sectionTitle"))
        title_box.addWidget(self._label("AS7341 · 10 bandas espectrales · cuentas ADC", "caption"))
        header_layout.addLayout(title_box)
        header_layout.addStretch(1)
        self.summary_label = QLabel("Sin lecturas")
        self.summary_label.setObjectName("caption")
        header_layout.addWidget(self.summary_label)
        layout.addWidget(header)
        separator = QFrame()
        separator.setFrameShape(QFrame.Shape.HLine)
        separator.setStyleSheet("color:#e1e7ed;")
        layout.addWidget(separator)
        self.plot = SpectralPlot(self)
        self.plot.setMinimumSize(390, 340)
        self.plot.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        empty_layout = QVBoxLayout(self.plot)
        empty_layout.setContentsMargins(0, 0, 0, 0)
        empty_layout.addStretch(1)
        self.plot_empty_state = QFrame()
        self.plot_empty_state.setObjectName("plotEmptyState")
        placeholder = QVBoxLayout(self.plot_empty_state)
        placeholder.setContentsMargins(18, 14, 18, 14)
        placeholder.setSpacing(6)
        sensor_icon = QLabel("▣")
        sensor_icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        sensor_icon.setStyleSheet("font-size:30px; color:#71869a;")
        placeholder.addWidget(sensor_icon)
        empty_title = QLabel("Sin lecturas")
        empty_title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        empty_title.setStyleSheet("font-size:16px; font-weight:650; color:#142b40;")
        placeholder.addWidget(empty_title)
        empty_copy = QLabel("Conecta el Arduino Mega para iniciar la adquisición")
        empty_copy.setObjectName("caption")
        empty_copy.setAlignment(Qt.AlignmentFlag.AlignCenter)
        placeholder.addWidget(empty_copy)
        review = QPushButton("Revisar conexión")
        review.clicked.connect(self._review_connection)
        placeholder.addWidget(review, 0, Qt.AlignmentFlag.AlignCenter)
        empty_layout.addWidget(self.plot_empty_state, 0, Qt.AlignmentFlag.AlignCenter)
        empty_layout.addStretch(1)
        layout.addWidget(self.plot, 1)
        return card

    def _readout_card(self) -> QFrame:
        card = QFrame()
        card.setObjectName("card")
        card.setFixedWidth(270)
        layout = QVBoxLayout(card)
        layout.setContentsMargins(14, 14, 14, 14)
        layout.setSpacing(8)
        layout.addWidget(self._label("Lectura actual", "sectionTitle"))
        layout.addWidget(self._label("Valores recibidos del AS7341", "caption"))
        self.table = QTableWidget(len(CHANNEL_KEYS), 2, self)
        self.table.setHorizontalHeaderLabels(("Canal", "Cuenta"))
        self.table.setAlternatingRowColors(True)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.verticalHeader().setVisible(False)
        self.table.verticalHeader().setDefaultSectionSize(21)
        self.table.horizontalHeader().setFixedHeight(26)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        for row, channel in enumerate(CHANNEL_KEYS):
            self.table.setItem(row, 0, QTableWidgetItem(channel.upper()))
            value = QTableWidgetItem("—")
            value.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self.table.setItem(row, 1, value)
        layout.addWidget(self.table, 1)
        context = self._subcard("Contexto de lectura")
        context_layout = context.layout()
        for name, value in (("Muestra", "—"), ("Tiempo", "—"), ("Ganancia", "128x"), ("Integración", "300 ms"), ("Fuente", "USB")):
            context_layout.addLayout(self._metric(name, value))
        layout.addWidget(context)
        copy_button = QPushButton("Copiar valores")
        copy_button.clicked.connect(self._copy_channel_values)
        layout.addWidget(copy_button)
        return card

    def _modernize_mirror(self, panel: DisplayMirror) -> None:
        """Añade el tercer panel de estado del instrumento del prototipo."""
        root = panel.layout()
        status_item = root.takeAt(0)
        content_item = root.takeAt(0)
        summary_item = root.takeAt(0)
        content = content_item.layout()
        readout = content.takeAt(0).widget()
        oled = content.takeAt(0).widget()

        root.addWidget(status_item.widget())
        columns = QHBoxLayout()
        columns.setSpacing(12)
        columns.addWidget(readout, 2)
        columns.addWidget(oled, 1)
        instrument = QFrame()
        instrument.setObjectName("sidePanel")
        instrument.setFixedWidth(235)
        info = QVBoxLayout(instrument)
        info.setContentsMargins(13, 13, 13, 13)
        info.setSpacing(9)
        info.addWidget(self._label("Instrumento", "sectionTitle"))
        info.addWidget(self._label("Disponibilidad y capacidades negociadas", "caption"))
        self.instrument_status_values = {}
        for key, value in (
            ("Firmware requerido", "2.3.0"),
            ("Protocolo", "JSON Lines v2"),
            ("AS7341", "Esperando"),
            ("Pantalla OLED", "Esperando"),
            ("Control PWM D11", "No verificado"),
            ("Baudios", "115200"),
        ):
            row, value_label = self._metric_with_value(key, value)
            self.instrument_status_values[key] = value_label
            info.addLayout(row)
        info.addStretch(1)
        verify = QPushButton("Verificar capacidades")
        verify.clicked.connect(lambda: self.client.send({"type": "command", "command": "get_state"}))
        self.verify_capabilities_button = verify
        info.addWidget(verify)
        columns.addWidget(instrument)
        root.addLayout(columns, 1)
        root.addWidget(summary_item.widget())

    def _modernize_experiments(self, panel: Experiments) -> None:
        """Distribuye método, flujo central y sesión como el HTML aprobado."""
        root = panel.layout()
        items = []
        while root.count():
            items.append(root.takeAt(0))
        top, conditions, identity = (items[index].layout() for index in range(3))
        status = items[3].widget()
        tabs = items[4].widget()
        result = items[5].widget()
        history = items[6].widget()
        actions = items[7].layout()

        root.setContentsMargins(18, 12, 18, 12)
        root.setSpacing(8)
        root.addLayout(top)
        root.addLayout(conditions)
        root.addLayout(identity)
        root.addWidget(status)

        body = QHBoxLayout()
        body.setSpacing(12)
        methods = QFrame()
        methods.setObjectName("sidePanel")
        methods.setFixedWidth(205)
        method_layout = QVBoxLayout(methods)
        method_layout.setContentsMargins(10, 12, 10, 12)
        method_layout.setSpacing(5)
        method_layout.addWidget(self._label("MÉTODO", "caption"))
        method_names = ("LED sucesivos", "Baseline y referencia", "Curva de calibración", "Blanco y fondo")
        panel.method_buttons = []
        for index, title in enumerate(method_names):
            button = QPushButton(title)
            button.setCheckable(True)
            button.setAutoExclusive(True)
            button.setChecked(index == 0)
            button.clicked.connect(lambda checked=False, page=index: tabs.setCurrentIndex(page))
            panel.method_buttons.append(button)
            method_layout.addWidget(button)
        method_layout.addStretch(1)
        body.addWidget(methods)

        tabs.tabBar().hide()
        center = QFrame()
        center.setObjectName("card")
        center_layout = QVBoxLayout(center)
        center_layout.setContentsMargins(10, 10, 10, 10)
        center_layout.addWidget(tabs)
        body.addWidget(center, 1)

        session = QFrame()
        session.setObjectName("sidePanel")
        session.setFixedWidth(245)
        session_layout = QVBoxLayout(session)
        session_layout.setContentsMargins(12, 12, 12, 12)
        session_layout.setSpacing(8)
        session_layout.addWidget(self._label("Sesión experimental", "sectionTitle"))
        session_layout.addWidget(self._label("Evidencia, historial y exportación", "caption"))
        session_layout.addWidget(result)
        while actions.count():
            action = actions.takeAt(0).widget()
            if action is not None:
                session_layout.addWidget(action)
        session_layout.addWidget(self._label("Historial del ensayo", "panelTitle"))
        session_layout.addWidget(history)
        session_layout.addStretch(1)
        body.addWidget(session)
        root.addLayout(body, 1)

        tabs.currentChanged.connect(
            lambda index: panel.method_buttons[index].setChecked(True)
            if 0 <= index < len(panel.method_buttons)
            else None
        )

    def _modernize_results(self, panel: ResultsQuality) -> None:
        """Convierte Resultados en resumen, evidencia e interpretación."""
        root = panel.layout()
        items = []
        while root.count():
            items.append(root.takeAt(0))
        title = items[0].widget()
        title.setObjectName("sectionTitle")
        intro = items[1].widget()
        selection = items[2].layout()
        criterion = items[3].layout()
        summary = items[4].widget()
        protocol = items[5].widget()
        quality = items[6].widget()
        detail_tabs = items[7].widget()
        export_status = items[8].widget()
        panel.detail_tabs = detail_tabs

        root.setContentsMargins(18, 12, 18, 12)
        root.setSpacing(9)
        header = QHBoxLayout()
        heading = QVBoxLayout()
        heading.addWidget(title)
        heading.addWidget(intro)
        header.addLayout(heading, 1)
        header.addLayout(selection, 2)
        root.addLayout(header)
        root.addLayout(criterion)

        body = QHBoxLayout()
        body.setSpacing(12)
        summary_panel = QFrame()
        summary_panel.setObjectName("sidePanel")
        summary_panel.setFixedWidth(245)
        left = QVBoxLayout(summary_panel)
        left.setContentsMargins(13, 13, 13, 13)
        left.setSpacing(9)
        left.addWidget(self._label("Resumen", "sectionTitle"))
        left.addWidget(self._label("Estado de la evidencia seleccionada", "caption"))
        left.addWidget(summary)
        left.addWidget(protocol)
        left.addStretch(1)
        body.addWidget(summary_panel)

        center = QFrame()
        center.setObjectName("card")
        center_layout = QVBoxLayout(center)
        center_layout.setContentsMargins(10, 10, 10, 10)
        center_layout.addWidget(detail_tabs)
        body.addWidget(center, 1)

        interpretation = QFrame()
        interpretation.setObjectName("sidePanel")
        interpretation.setFixedWidth(245)
        right = QVBoxLayout(interpretation)
        right.setContentsMargins(13, 13, 13, 13)
        right.setSpacing(9)
        right.addWidget(self._label("Interpretación", "sectionTitle"))
        right.addWidget(self._label("Conclusiones permitidas por la evidencia", "caption"))
        right.addWidget(panel.concentration)
        right.addWidget(quality)
        right.addWidget(export_status)
        right.addStretch(1)
        body.addWidget(interpretation)
        root.addLayout(body, 1)

    @staticmethod
    def _workspace_scroll(widget: QWidget, name: str) -> QScrollArea:
        scroll = QScrollArea()
        scroll.setObjectName(name)
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setWidget(widget)
        return scroll

    @staticmethod
    def _label(text: str, object_name: str) -> QLabel:
        label = QLabel(text)
        label.setObjectName(object_name)
        return label

    def _subcard(self, title: str) -> QFrame:
        card = QFrame()
        card.setObjectName("subCard")
        layout = QVBoxLayout(card)
        layout.setContentsMargins(11, 10, 11, 10)
        layout.setSpacing(7)
        layout.addWidget(self._label(title, "panelTitle"))
        return card

    @staticmethod
    def _field(label: str, control: QWidget) -> QHBoxLayout:
        row = QHBoxLayout()
        row.setSpacing(7)
        caption = QLabel(label)
        caption.setObjectName("caption")
        caption.setMinimumWidth(68)
        row.addWidget(caption)
        row.addWidget(control, 1)
        return row

    @staticmethod
    def _metric(label: str, value: str) -> QHBoxLayout:
        row = QHBoxLayout()
        key = QLabel(label)
        key.setObjectName("caption")
        val = QLabel(value)
        val.setAlignment(Qt.AlignmentFlag.AlignRight)
        row.addWidget(key)
        row.addStretch(1)
        row.addWidget(val)
        return row

    @staticmethod
    def _metric_with_value(label: str, value: str) -> tuple[QHBoxLayout, QLabel]:
        row = QHBoxLayout()
        key = QLabel(label)
        key.setObjectName("caption")
        val = QLabel(value)
        val.setAlignment(Qt.AlignmentFlag.AlignRight)
        row.addWidget(key)
        row.addStretch(1)
        row.addWidget(val)
        return row, val

    def _select_workspace(self, index: int) -> None:
        self.workspace.setCurrentIndex(index)
        if 0 <= index < len(self.navigation_buttons):
            self.navigation_buttons[index].setChecked(True)

    def _sync_sample_id(self, sample_id: str) -> None:
        text = sample_id.strip()
        self.sample_selector.setItemText(0, text if text else "Sin asignar")

    def _copy_channel_values(self) -> None:
        values = []
        for row in range(self.table.rowCount()):
            values.append(f"{self.table.item(row, 0).text()}\t{self.table.item(row, 1).text()}")
        QApplication.clipboard().setText("\n".join(values))

    def _append_log(self, message: str) -> None:
        super()._append_log(message)
        cursor = QTextCursor(self.log.document())
        cursor.select(QTextCursor.SelectionType.Document)
        block_format = QTextBlockFormat()
        block_format.setLineHeight(
            125,
            QTextBlockFormat.LineHeightTypes.ProportionalHeight.value,
        )
        cursor.mergeBlockFormat(block_format)
        self.log.horizontalScrollBar().setValue(0)

    def _review_connection(self) -> None:
        self.port_selector.setFocus(Qt.FocusReason.ShortcutFocusReason)
        self.statusBar().showMessage("Selecciona el puerto USB del Arduino Mega y pulsa Conectar.", 6_000)

    def refresh_link_status(self) -> None:
        super().refresh_link_status()
        if not hasattr(self, "top_connection_status"):
            return
        if self.client.connected_port is None:
            self.top_connection_status.setText("○  Sin conexión")
        elif self._verified:
            self.top_connection_status.setText("●  Instrumento listo")
        else:
            self.top_connection_status.setText("○  Verificando")
        if not hasattr(self, "instrument_status_values"):
            return
        connected = self.client.connected_port is not None
        recent = bool(
            connected
            and self._verified
            and self._last_telemetry_at is not None
            and monotonic() - self._last_telemetry_at < 5
        )
        self.instrument_status_values["AS7341"].setText(
            "Listo" if recent else ("Verificando" if connected else "Sin conexión")
        )
        self.instrument_status_values["Pantalla OLED"].setText(
            "Activa" if recent else ("Esperando datos" if connected else "Sin conexión")
        )
        self.instrument_status_values["Control PWM D11"].setText(
            "Disponible" if self._verified else ("Verificando" if connected else "No verificado")
        )
        self.verify_capabilities_button.setEnabled(connected)

    def _set_record_button_state(self, recording: bool) -> None:
        super()._set_record_button_state(recording)
        self.record_button.setText("●  Detener y guardar" if recording else "●  Iniciar grabación")

    def toggle_auto_scale(self, enabled: bool) -> None:
        self.scale_maximum.setEnabled(not enabled)
        self.auto_scale_button.setText("Automática" if enabled else "Fija")
        if enabled and hasattr(self, "plot"):
            self._update_auto_scale()

    def _update_telemetry(self, telemetry: dict[str, object]) -> None:
        super()._update_telemetry(telemetry)
        self.plot_empty_state.hide()

    def resizeEvent(self, event) -> None:  # noqa: N802
        super().resizeEvent(event)
        if hasattr(self, "log"):
            self.log.setFixedHeight(98 if event.size().height() >= 820 else 66)


def main() -> int:
    application = QApplication.instance() or QApplication(sys.argv)
    window = MainWindowV2()
    window.show()
    return application.exec()


if __name__ == "__main__":
    raise SystemExit(main())
