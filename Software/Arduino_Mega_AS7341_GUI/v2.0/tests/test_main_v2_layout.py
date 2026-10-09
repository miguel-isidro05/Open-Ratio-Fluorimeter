import importlib.util
import tempfile
import unittest
from pathlib import Path

from PyQt6.QtCore import QRect
from PyQt6.QtWidgets import QApplication, QGroupBox, QLabel, QPlainTextEdit, QStackedWidget, QWidget


VERSION_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = VERSION_ROOT / "design_prototype" / "main" / "main_v2.py"


def load_main_v2():
    spec = importlib.util.spec_from_file_location("spectral_lab_main_v2", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class MainV2LayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])
        cls.module = load_main_v2()

    def test_approved_shell_and_four_workspaces_are_present(self):
        with tempfile.TemporaryDirectory() as directory:
            window = self.module.MainWindowV2(session_dir=directory)
            window.resize(1280, 720)
            window.show()
            self.app.processEvents()

            self.assertEqual(window.minimumWidth(), 1180)
            self.assertEqual(window.minimumHeight(), 720)
            self.assertIsInstance(window.workspace, QStackedWidget)
            self.assertEqual(window.workspace.count(), 4)
            self.assertEqual(
                [button.text() for button in window.navigation_buttons],
                ["Adquisición", "Instrumento", "Experimentos", "Resultados"],
            )
            self.assertFalse(window.findChild(QLabel, "institutionLogo").pixmap().isNull())
            self.assertIsNone(window.findChild(QWidget, "trafficControls"))
            self.assertEqual(window.workspace.currentIndex(), 0)
            window.navigation_buttons[2].click()
            self.assertEqual(window.workspace.currentIndex(), 2)
            window._select_workspace(1)
            self.app.processEvents()
            self.assertTrue(any("OLED" in box.title() for box in window.mirror.findChildren(QGroupBox)))
            self.assertEqual(window.instrument_status_values["Pantalla OLED"].text(), "Sin conexión")
            self.assertFalse(window.verify_capabilities_button.isEnabled())
            window.close()

    def test_acquisition_columns_fit_without_horizontal_scroll(self):
        with tempfile.TemporaryDirectory() as directory:
            window = self.module.MainWindowV2(session_dir=directory)
            window.resize(1280, 720)
            window.show()
            self.app.processEvents()

            self.assertGreater(window.plot.width(), window.table.width())
            self.assertGreaterEqual(window.acquisition_sidebar.width(), 270)
            self.assertGreaterEqual(window.log.height(), 64)
            self.assertEqual(window.log.font().pixelSize(), 10)
            self.assertEqual(window.log.lineWrapMode(), QPlainTextEdit.LineWrapMode.NoWrap)
            window._append_log("segunda línea de verificación")
            self.assertEqual(window.log.document().lastBlock().blockFormat().lineHeight(), 125)
            self.assertGreaterEqual(window.readout_panel.width(), 230)
            self.assertEqual(window.table.verticalScrollBar().maximum(), 0)
            self.assertTrue(window.plot_empty_state.isVisible())
            plot_rect = QRect(window.plot.mapToGlobal(window.plot.rect().topLeft()), window.plot.size())
            table_rect = QRect(window.table.mapToGlobal(window.table.rect().topLeft()), window.table.size())
            self.assertFalse(plot_rect.intersects(table_rect))

            window._select_workspace(2)
            self.app.processEvents()
            self.assertEqual(len(window.experiments.method_buttons), 4)
            self.assertTrue(window.experiments.tabs.tabBar().isHidden())

            window._select_workspace(3)
            self.app.processEvents()
            self.assertEqual(window.results_quality.detail_tabs.count(), 3)
            window.resize(1600, 900)
            self.app.processEvents()
            self.assertGreaterEqual(window.log.height(), 90)
            window.close()


if __name__ == "__main__":
    unittest.main()
